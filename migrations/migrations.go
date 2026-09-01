// Package migrations embarque les fichiers SQL de golang-migrate dans le
// binaire, pour que api/ingester n'aient besoin d'aucun montage de volume
// supplémentaire en Docker.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
