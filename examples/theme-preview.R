# RStudio Claude Style
# A small analysis. A calmer workspace.
# Public demo data only: datasets::iris

flowers <- datasets::iris

# Inspect the data before drawing conclusions.
stopifnot(nrow(flowers) == 150L)
table(flowers$Species)

# Color and shape both identify each species.
colors <- c("#D97757", "#A6B88A", "#8FAFC1")
symbols <- c(16, 17, 15)
group <- as.integer(flowers$Species)

par(bg = "#1f1f1c", fg = "#e4dfd7",
    col.axis = "#bcb5a9", col.lab = "#e4dfd7",
    col.main = "#e4dfd7", mar = c(4, 4, 3, 1))

plot(Sepal.Width ~ Sepal.Length, data = flowers,
     col = colors[group], pch = symbols[group],
     cex = 1.3, bty = "n",
     xlab = "Sepal length (cm)",
     ylab = "Sepal width (cm)",
     main = "One dataset. Three species.")

legend("topright", legend = levels(flowers$Species),
       col = colors, pch = symbols,
       text.col = "#e4dfd7", bty = "n")