package main

import "lacuna/internal/ingest"

// Chaînes YouTube suivies, par (langue, centre d'intérêt).
//
// Chaque identifiant est résolu depuis le handle public puis vérifié en
// direct : flux accessible, langue contrôlée sur les titres réels et non
// déduite du nom (@SkySport aurait pu être la chaîne britannique), et
// audience mesurée avec tools/rank-channels.mjs — vues et likes médians sur
// les 15 dernières vidéos. La médiane, pas la moyenne : une seule vidéo
// virale ferait passer pour populaire une chaîne qui ne l'est pas.
//
// Les chiffres en commentaire datent de la mesure et servent de repère, pas
// de vérité figée. Une chaîne faible n'est pas retirée pour autant : le
// classement par popularité la fait descendre d'elle-même, et la garder
// préserve un fond de contenu quand une catégorie est cochée seule. Seules
// les chaînes mortes partent.
//
// Écartées, pour mémoire : @FormulaPassion (chaîne existante mais flux sans
// aucune entrée), @Quattroruote (2 vidéos), @LOS40 (43 vues médianes,
// dernière vidéo il y a plus de douze ans).
var videoChannels = []ingest.SeedVideoChannel{
	// Italien
	{YouTubeChannelID: "UCegEedDeryCYSVT7eBCm-RQ", Name: "Podcast Italiano", Lang: "it", Category: "langue"},       // ~10 400 vues
	{YouTubeChannelID: "UChpDG_WQkf_2tgLUr9xTR0g", Name: "Easy Italian", Lang: "it", Category: "langue"},           // ~6 100
	{YouTubeChannelID: "UCfmCGVXfpAMSi4PP8kqWlbA", Name: "Cronache di Spogliatoio", Lang: "it", Category: "sport"}, // ~48 400
	{YouTubeChannelID: "UCAvNr5DMVncoJnJAotXOjOQ", Name: "Sky Sport", Lang: "it", Category: "sport"},               // ~4 600
	{YouTubeChannelID: "UCdufkvMrmyR1TMhDG8PhsJw", Name: "HDblog", Lang: "it", Category: "informatique"},           // ~2 100
	{YouTubeChannelID: "UCt9Q9JTC-ieDLvQOveX5mNw", Name: "Rolling Stone Italia", Lang: "it", Category: "musique"},  // ~1 700, maillon faible
	{YouTubeChannelID: "UCcKdVXVhcp-Qv0i8Ov6_K4Q", Name: "Motorbox", Lang: "it", Category: "auto"},                 // ~3 900
	{YouTubeChannelID: "UC3u7URxSqN70zuJ5Yb_ryPg", Name: "Motor1 Italia", Lang: "it", Category: "auto"},            // ~18 800

	// Espagnol
	{YouTubeChannelID: "UCouyFdE9-Lrjo3M_2idKq1A", Name: "Dreaming Spanish", Lang: "es", Category: "langue"},    // ~15 800
	{YouTubeChannelID: "UCoHJ7PkM6T92LwgJgrnDhWA", Name: "Español con Juan", Lang: "es", Category: "langue"},    // ~22 100
	{YouTubeChannelID: "UCi7TVXyvrIwqeS9tfYD8UDA", Name: "DjMaRiiO", Lang: "es", Category: "sport"},             // ~276 300
	{YouTubeChannelID: "UCop57Z1sYHrtCyxCpE2z2Bg", Name: "MARCA", Lang: "es", Category: "sport"},                // ~1 300
	{YouTubeChannelID: "UC36xmz34q02JYaZYKrMwXng", Name: "Nate Gentile", Lang: "es", Category: "informatique"},  // ~437 900
	{YouTubeChannelID: "UCok_yhjwg4WSx3s_2Yh8ZjQ", Name: "Topes de Gama", Lang: "es", Category: "informatique"}, // ~22 000
	{YouTubeChannelID: "UCmS75G-98QihSusY7NfCZtw", Name: "Bizarrap", Lang: "es", Category: "musique"},           // ~51 650 000
	// Journaliste F1 : l'analyse d'un passionné plutôt qu'une dépêche.
	{YouTubeChannelID: "UCklUGqDiqiIak4PWh-qbhxQ", Name: "Albert Fábrega", Lang: "es", Category: "auto"}, // ~94 800
	{YouTubeChannelID: "UCriizUOvtsM4mhLw1KGVzvQ", Name: "SoyMotor", Lang: "es", Category: "auto"},       // ~38 700
	{YouTubeChannelID: "UCfdj_0piEWBCfAueG4V32Ag", Name: "Diariomotor", Lang: "es", Category: "auto"},    // ~14 100
}
