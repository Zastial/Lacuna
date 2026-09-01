package main

// Feed is a candidate podcast RSS feed to probe for exploitable transcripts.
type Feed struct {
	Name  string
	URL   string
	Lang  string // "en" | "es" | "it"
	Level string // "native" | "learner_beginner" | "learner_intermediate"
}

// candidateFeeds is the Phase 0 input list (§8 du plan). Chaque URL a été
// vérifiée accessible avant d'être ajoutée à cette liste ; ce que le spike
// détermine, c'est laquelle expose réellement un transcript exploitable.
var candidateFeeds = []Feed{
	// EN natif
	{Name: "Latino USA", URL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/eba15fe4-c3fd-4e63-a8f9-b2dc01092685/a324c6a1-2e41-486b-b538-b2dc010926c5/podcast.rss", Lang: "en", Level: "native"},
	{Name: "Up First (NPR)", URL: "https://feeds.npr.org/510318/podcast.xml", Lang: "en", Level: "native"},
	{Name: "This American Life", URL: "https://feeds.thisamericanlife.org/talpodcast", Lang: "en", Level: "native"},
	{Name: "Freakonomics Radio", URL: "https://www.omnycontent.com/d/playlist/aaea4e69-af51-495e-afc9-a9760146922b/14a43378-edb2-49be-8511-ab0d000a7030/d1b9612f-bb1b-4b85-9c0c-ab0d004ab37a/podcast.rss", Lang: "en", Level: "native"},
	{Name: "In The Thick", URL: "https://feeds.acast.com/public/shows/in-the-thick-ad-free", Lang: "en", Level: "native"},
	{Name: "Reveal", URL: "https://feeds.revealradio.org/revealpodcast", Lang: "en", Level: "native"},

	// ES natif
	{Name: "Radio Ambulante", URL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/b3c9b6e7-72ba-45c4-aff9-b1e7012d213b/092b66a8-4329-4183-bb12-b1e7012d216f/podcast.rss", Lang: "es", Level: "native"},
	{Name: "El Hilo", URL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/b9075595-43ce-4bdd-9a4c-b1ea01352a3d/e4eb1040-260e-4556-a9c7-b1ea01352a67/podcast.rss", Lang: "es", Level: "native"},

	// ES apprenants
	{Name: "Hoy Hablamos", URL: "https://www.hoyhablamos.com/category/podcast/feed/", Lang: "es", Level: "learner_intermediate"},
	{Name: "Español Automático", URL: "https://espanolautomatico.libsyn.com/rss", Lang: "es", Level: "learner_intermediate"},
	{Name: "Notes in Spanish (Intermediate)", URL: "https://intnotesinspanish.libsyn.com/rss", Lang: "es", Level: "learner_intermediate"},
	{Name: "Notes in Spanish (Inspired Beginners)", URL: "https://learnrealspanish.libsyn.com/rss", Lang: "es", Level: "learner_beginner"},

	// IT débutants (le maillon faible identifié dans le plan)
	{Name: "Podcast Italiano Principiante", URL: "https://feeds.acast.com/public/shows/668fd0eaa0179c311c39e769", Lang: "it", Level: "learner_beginner"},
	{Name: "Podcast Italiano (Intermediate/Advanced)", URL: "https://feeds.buzzsprout.com/2413795.rss", Lang: "it", Level: "learner_intermediate"},
	{Name: "Coffee Break Italian", URL: "https://feeds.acast.com/public/shows/86766c5f-1580-450f-9376-bd74b57fcfbb", Lang: "it", Level: "learner_beginner"},
	{Name: "News in Slow Italian", URL: "https://nsi.libsyn.com/rss", Lang: "it", Level: "learner_beginner"},
	{Name: "LearnAmo", URL: "https://learnamo.com/feed/podcast/", Lang: "it", Level: "learner_beginner"},
}
