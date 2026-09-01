package main

import "lacuna/internal/ingest"

// seedFeeds : flux confirmés exploitables lors du spike Phase 0 (voir
// PHASE0-RESULTAT.md). Le catalogue s'élargira au fil de l'eau — ajouter une
// entrée ici suffit, SeedFeeds est idempotent (ON CONFLICT DO NOTHING).
var seedFeeds = []ingest.SeedFeed{
	{RSSURL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/eba15fe4-c3fd-4e63-a8f9-b2dc01092685/a324c6a1-2e41-486b-b538-b2dc010926c5/podcast.rss", Title: "Latino USA", Lang: "en", Level: "native"},
	{RSSURL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/759cedb2-b3e2-4407-a599-b34d00fb38a6/bffd2c26-6b20-4ca7-bf31-b34d00fb3cab/podcast.rss", Title: "The Moment with Jorge Ramos and Paola Ramos", Lang: "en", Level: "native"},

	{RSSURL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/b3c9b6e7-72ba-45c4-aff9-b1e7012d213b/092b66a8-4329-4183-bb12-b1e7012d216f/podcast.rss", Title: "Radio Ambulante", Lang: "es", Level: "native"},
	{RSSURL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/b9075595-43ce-4bdd-9a4c-b1ea01352a3d/e4eb1040-260e-4556-a9c7-b1ea01352a67/podcast.rss", Title: "El Hilo", Lang: "es", Level: "native"},
	{RSSURL: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/0367bfd5-c9a2-4b46-b584-b1ea013507bc/50dacf3a-5b3c-4655-bae4-b1ea013507ef/podcast.rss", Title: "Central", Lang: "es", Level: "native"},

	{RSSURL: "https://feeds.acast.com/public/shows/668fd0eaa0179c311c39e769", Title: "Podcast Italiano Principiante", Lang: "it", Level: "beginner"},
}
