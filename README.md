 Esports & Gaming Stats Dashboard
 
An analytics dashboard that displays trending games, real-time stats, and interactive charts, built using HTML, CSS, JavaScript, and Chart.js with data powered by the RAWG Video Game Database API.

Live Features
Trending Games

Shows the latest trending games fetched from the RAWG API

Clean grid layout with scroll support

Each game card includes:

Name

Rating

Release Date

Player Activity (Added Count)

Search System

Real-time filtering of the game list

Updates charts and list instantly

Interactive Charts (Chart.js)

Visual stats generated from the loaded game list:

Pie Chart → Top Genres

Doughnut Chart → Top Platforms

Bar Chart → Ratings Distribution (0–10)

Detailed Game Insights

Click a game card to load:

High-resolution background image

Full game name

Genres

Platforms

Ratings + Votes

Metacritic Score

Short description

RAWG page link

Tech Stack

HTML5 – Structure

CSS3 – Layout + UI styling

JavaScript (ES6) – Logic, Fetch API, event handling

Chart.js – Graphs & visualization

RAWG.io API – Trending game data & detailed lookups

How It Works

On page load, the dashboard calls:

https://api.rawg.io/api/games?key=API_KEY&page_size=40&ordering=-added


Games are rendered as cards in a grid.

All stats are computed:

Genre frequency

Platform breakdown

Rating buckets

Charts are dynamically created using Chart.js.

On clicking a game:

Dashboard fetches /games/{slug} for detailed information.

 Project Structure
/ (root)
│── index.html
│── styles.css
│── app.js
│── README.md  ← (this file)


API Reference (RAWG)

RAWG API Documentation:
https://rawg.io/apidocs

Endpoints used:

/games — trending games

/games/{id-or-slug} — full detailed info

Installation & Usage
Open Directly
Simply download the repo and open:
index.html

Screenshots
<img width="1885" height="1020" alt="Screenshot 2025-11-15 075448" src="https://github.com/user-attachments/assets/65cb8b4b-4707-4c69-8d29-fd7c3968f4c1" />

<img width="1887" height="843" alt="image" src="https://github.com/user-attachments/assets/57a4a45f-66a2-4004-b70b-83708304eb2d" />

 #Author

Shashank
Frontend 
