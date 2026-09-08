package main

import "lacuna/internal/ingest"

// seedArticleFeeds : flux RSS texte vérifiés en direct (curl, réponse 200 +
// items datés du jour) avant d'être ajoutés ici — agence de presse et grand
// quotidien par langue pour varier le registre.
var seedArticleFeeds = []ingest.SeedArticleFeed{
	{RSSURL: "https://www.ansa.it/sito/ansait_rss.xml", SourceName: "ANSA", Lang: "it"},
	{RSSURL: "https://www.repubblica.it/rss/homepage/rss2.0.xml", SourceName: "la Repubblica", Lang: "it"},

	{RSSURL: "https://feeds.bbci.co.uk/mundo/rss.xml", SourceName: "BBC Mundo", Lang: "es"},
	{RSSURL: "https://www.infobae.com/arc/outboundfeeds/rss/", SourceName: "Infobae", Lang: "es"},

	// Sport en français : la source est dans la langue de l'utilisateur, la
	// valeur pédagogique vient de la traduction en langue cible. Les
	// anciennes URLs lequipe.fr/rss/*.xml renvoient 404 depuis leur refonte —
	// l'endpoint courant est dwh.lequipe.fr, filtrable par rubrique.
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Football/", SourceName: "L'Équipe", Lang: "fr", Sport: "football"},
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Tennis/", SourceName: "L'Équipe", Lang: "fr", Sport: "tennis"},
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Rugby/", SourceName: "L'Équipe", Lang: "fr", Sport: "rugby"},
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Cyclisme/", SourceName: "L'Équipe", Lang: "fr", Sport: "cyclisme"},
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Basket/", SourceName: "L'Équipe", Lang: "fr", Sport: "basket"},
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Formule-1/", SourceName: "L'Équipe", Lang: "fr", Sport: "formule-1"},
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Handball/", SourceName: "L'Équipe", Lang: "fr", Sport: "handball"},
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Athletisme/", SourceName: "L'Équipe", Lang: "fr", Sport: "athlétisme"},
	// Le chemin est "Volley-ball" : /Volley/ et /Volleyball/ répondent 200
	// avec un flux vide plutôt qu'une 404.
	{RSSURL: "https://dwh.lequipe.fr/api/edito/rss?path=/Volley-ball/", SourceName: "L'Équipe", Lang: "fr", Sport: "volley"},
}
