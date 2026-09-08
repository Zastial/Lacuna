package main

import "lacuna/internal/ingest"

// Chaînes YouTube suivies, une par (langue, centre d'intérêt).
//
// Chaque identifiant a été résolu depuis le handle public puis vérifié en
// direct : flux Atom accessible et 15 vidéos servies, sauf mention. La langue
// a été contrôlée sur les titres réels, pas déduite du nom — @SkySport aurait
// pu être la chaîne britannique, ses titres sont bien en italien.
//
// @FormulaPassion a été écartée de la catégorie auto : la chaîne existe mais
// son flux Atom ne renvoie aucune entrée, elle n'aurait rien apporté.
var videoChannels = []ingest.SeedVideoChannel{
	// Italien
	{YouTubeChannelID: "UCegEedDeryCYSVT7eBCm-RQ", Name: "Podcast Italiano", Lang: "it", Category: "langue"},
	{YouTubeChannelID: "UChpDG_WQkf_2tgLUr9xTR0g", Name: "Easy Italian", Lang: "it", Category: "langue"},
	{YouTubeChannelID: "UCfmCGVXfpAMSi4PP8kqWlbA", Name: "Cronache di Spogliatoio", Lang: "it", Category: "sport"},
	{YouTubeChannelID: "UCAvNr5DMVncoJnJAotXOjOQ", Name: "Sky Sport", Lang: "it", Category: "sport"},
	{YouTubeChannelID: "UCdufkvMrmyR1TMhDG8PhsJw", Name: "HDblog", Lang: "it", Category: "informatique"},
	{YouTubeChannelID: "UCt9Q9JTC-ieDLvQOveX5mNw", Name: "Rolling Stone Italia", Lang: "it", Category: "musique"},
	{YouTubeChannelID: "UCcKdVXVhcp-Qv0i8Ov6_K4Q", Name: "Motorbox", Lang: "it", Category: "auto"},
	{YouTubeChannelID: "UC3u7URxSqN70zuJ5Yb_ryPg", Name: "Motor1 Italia", Lang: "it", Category: "auto"},

	// Espagnol
	{YouTubeChannelID: "UCouyFdE9-Lrjo3M_2idKq1A", Name: "Dreaming Spanish", Lang: "es", Category: "langue"},
	{YouTubeChannelID: "UCoHJ7PkM6T92LwgJgrnDhWA", Name: "Español con Juan", Lang: "es", Category: "langue"},
	{YouTubeChannelID: "UCop57Z1sYHrtCyxCpE2z2Bg", Name: "MARCA", Lang: "es", Category: "sport"},
	{YouTubeChannelID: "UCok_yhjwg4WSx3s_2Yh8ZjQ", Name: "Topes de Gama", Lang: "es", Category: "informatique"},
	// LOS40 ne publie que 5 vidéos dans son flux, contre 15 ailleurs.
	{YouTubeChannelID: "UChpDvNUea_vtz5L9XRvFl6w", Name: "LOS40", Lang: "es", Category: "musique"},
	{YouTubeChannelID: "UCriizUOvtsM4mhLw1KGVzvQ", Name: "SoyMotor", Lang: "es", Category: "auto"},
	{YouTubeChannelID: "UCfdj_0piEWBCfAueG4V32Ag", Name: "Diariomotor", Lang: "es", Category: "auto"},
}
