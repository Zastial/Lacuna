package rssfeed

import (
	"bytes"
	"encoding/xml"
	"fmt"
)

// YouTube publie un flux Atom par chaîne, pas du RSS 2.0 : la racine est
// <feed> et les éléments des <entry>, d'où un parseur distinct de Parse.
//
// L'intérêt décisif de ce flux est qu'il ne demande **aucune clé d'API** —
// il donne les 15 dernières vidéos avec identifiant, titre, description,
// miniature et date, ce qui suffit à alimenter le mode Vidéos sans quota ni
// compte Google à gérer.
type YouTubeFeed struct {
	XMLName xml.Name       `xml:"feed"`
	Title   string         `xml:"title"`
	Entries []YouTubeEntry `xml:"entry"`
}

type YouTubeEntry struct {
	VideoID   string       `xml:"http://www.youtube.com/xml/schemas/2015 videoId"`
	Title     string       `xml:"title"`
	Published string       `xml:"published"`
	Group     YouTubeGroup `xml:"http://search.yahoo.com/mrss/ group"`
}

type YouTubeGroup struct {
	Title       string           `xml:"http://search.yahoo.com/mrss/ title"`
	Description string           `xml:"http://search.yahoo.com/mrss/ description"`
	Thumbnail   YouTubeThumbnail `xml:"http://search.yahoo.com/mrss/ thumbnail"`
	Community   YouTubeCommunity `xml:"http://search.yahoo.com/mrss/ community"`
}

// Vues et likes voyagent dans le flux : c'est ce qui permet de classer par
// popularité sans clé d'API. starRating/@count est le nombre de likes.
type YouTubeCommunity struct {
	StarRating YouTubeStarRating `xml:"http://search.yahoo.com/mrss/ starRating"`
	Statistics YouTubeStatistics `xml:"http://search.yahoo.com/mrss/ statistics"`
}

type YouTubeStarRating struct {
	Count int64 `xml:"count,attr"`
}

type YouTubeStatistics struct {
	Views int64 `xml:"views,attr"`
}

type YouTubeThumbnail struct {
	URL string `xml:"url,attr"`
}

// ChannelFeedURL construit l'URL du flux Atom d'une chaîne.
func ChannelFeedURL(channelID string) string {
	return "https://www.youtube.com/feeds/videos.xml?channel_id=" + channelID
}

// ParseYouTube lit le flux en mode tolérant, pour la même raison que Parse :
// une entité mal formée dans un seul titre ne doit pas rendre les quinze
// vidéos inexploitables.
func ParseYouTube(body []byte) (*YouTubeFeed, error) {
	decoder := xml.NewDecoder(bytes.NewReader(body))
	decoder.Strict = false
	decoder.Entity = xml.HTMLEntity

	var feed YouTubeFeed
	if err := decoder.Decode(&feed); err != nil {
		return nil, fmt.Errorf("parse youtube atom: %w", err)
	}
	return &feed, nil
}
