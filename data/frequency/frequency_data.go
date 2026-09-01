// Package frequencydata embarque les listes de fréquence (voir SOURCE.md)
// dans le binaire, sur le même principe que migrations.FS.
package frequencydata

import "embed"

//go:embed *.txt
var FS embed.FS
