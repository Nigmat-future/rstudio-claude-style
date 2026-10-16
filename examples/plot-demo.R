# Run: Rscript --vanilla plot-demo.R output
# The example uses only the built-in iris data and base R graphics.
plot_demo <- function(output_dir) {
  if (!is.character(output_dir) || length(output_dir) != 1L ||
      is.na(output_dir) || !nzchar(trimws(output_dir))) {
    stop("output_dir must be one non-empty directory path.")
  }
  if (!dir.exists(output_dir) && !dir.create(output_dir, recursive = TRUE)) {
    stop("Cannot create output directory: ", output_dir)
  }
  output_dir <- normalizePath(output_dir, winslash = "/", mustWork = TRUE)
  targets <- file.path(output_dir, c("iris-sepal.png", "iris-sepal.pdf"))
  if (any(file.exists(targets))) {
    stop("Output already exists; choose another directory: ",
         paste(targets[file.exists(targets)], collapse = ", "))
  }

  data <- datasets::iris
  complete <- stats::complete.cases(data[c("Sepal.Length", "Sepal.Width", "Species")])
  plotted <- data[complete, , drop = FALSE]
  counts <- table(plotted$Species)
  # ponytail: iris needs no sampling, so this demo has no random step or seed.
  draw <- function() {
    colors <- c("#0072B2", "#D55E00", "#009E73")
    symbols <- c(16L, 17L, 15L)
    group <- as.integer(plotted$Species)
    graphics::par(mar = c(4.5, 4.5, 3.5, 1), las = 1)
    graphics::plot(
      plotted$Sepal.Length, plotted$Sepal.Width,
      col = colors[group], pch = symbols[group], cex = 1.1,
      xlab = "Sepal length (cm)", ylab = "Sepal width (cm)",
      main = "Iris sepal measurements"
    )
    graphics::mtext(sprintf("n = %d; excluded NA rows = %d",
                           nrow(plotted), sum(!complete)), side = 3, cex = 0.85)
    graphics::legend("topright", legend = sprintf("%s (n = %d)", names(counts), counts),
                     col = colors, pch = symbols, bty = "n", cex = 0.85)
  }
  temporary <- c(tempfile("iris-", output_dir, ".png"),
                 tempfile("iris-", output_dir, ".pdf"))
  on.exit(unlink(temporary), add = TRUE)
  render <- function(path, format) {
    if (format == "png") {
      grDevices::png(path, width = 1800, height = 1350, res = 240)
    } else {
      grDevices::pdf(path, width = 7.5, height = 5.625, useDingbats = FALSE)
    }
    device <- grDevices::dev.cur()
    on.exit(grDevices::dev.off(device), add = TRUE)
    draw()
  }
  render(temporary[1L], "png")
  render(temporary[2L], "pdf")
  for (index in seq_along(targets)) {
    if (!file.copy(temporary[index], targets[index], overwrite = FALSE)) {
      stop("Could not write output without overwriting: ", targets[index])
    }
  }
  invisible(list(files = targets, rows_total = nrow(data), rows_used = nrow(plotted),
                 rows_excluded_na = sum(!complete), group_counts = counts,
                 random_seed = NULL))
}

if (sys.nframe() == 0L) {
  arguments <- commandArgs(trailingOnly = TRUE)
  if (length(arguments) > 1L) stop("Usage: Rscript plot-demo.R [output_directory]")
  output_dir <- if (length(arguments)) arguments[1L] else "output"
  previous_device <- grDevices::dev.cur()
  result <- plot_demo(output_dir)
  stopifnot(all(file.exists(result$files)), all(file.info(result$files)$size > 1000),
            result$rows_total == 150L, result$rows_used == 150L,
            result$rows_excluded_na == 0L, all(result$group_counts == 50L),
            identical(grDevices::dev.cur(), previous_device))
  original_checksums <- tools::md5sum(result$files)
  conflict <- tryCatch(plot_demo(output_dir), error = identity)
  stopifnot(inherits(conflict, "error"),
            identical(tools::md5sum(result$files), original_checksums))
  print(result)
  cat("Checks passed: PNG/PDF created; devices closed; existing files preserved.\n")
}
