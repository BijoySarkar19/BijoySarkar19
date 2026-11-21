import fs from "node:fs";
import path from "node:path";

const USER = process.env.GITHUB_USERNAME || "BijoySarkar19";
const TOKEN = process.env.GITHUB_TOKEN;
const ROOT = process.cwd();
const GENERATED = path.join(ROOT, "assets", "generated");
const README_PATH = path.join(ROOT, "README.md");

if (!TOKEN) throw new Error("GITHUB_TOKEN is missing.");

fs.mkdirSync(GENERATED, { recursive: true });

async function github(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${url}`);
  }

  return response.json();
}

async function graphql(query, variables = {}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors?.length) {
    throw new Error(data.errors.map(e => e.message).join("; "));
  }

  return data.data;
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function writeSVG(filename, svg) {
  fs.writeFileSync(path.join(GENERATED, filename), svg, "utf8");
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getContributionColor(count) {
  if (count === 0) return "#161B22";
  if (count < 3) return "#0E4429";
  if (count < 6) return "#006D32";
  if (count < 10) return "#26A641";
  return "#39D353";
}

function buildCalendarSVG(contributionDays) {
  const width = 1000;
  const height = 220;
  const cell = 12;
  const gap = 3;
  const left = 48;
  const top = 48;

  const days = [...contributionDays];
  const weeks = [];

  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  let total = 0;
  let squares = "";
  let monthLabels = "";
  let previousMonth = -1;

  weeks.forEach((week, weekIndex) => {
    week.forEach((day, dayIndex) => {
      const count = day.contributionCount || 0;
      total += count;

      const x = left + weekIndex * (cell + gap);
      const y = top + dayIndex * (cell + gap);

      squares += `
        <rect x="${x}" y="${y}" width="${cell}" height="${cell}"
          rx="3" fill="${getContributionColor(count)}">
          <title>${escapeHTML(day.date)}: ${count} contributions</title>
        </rect>`;
    });

    const firstDay = week[0];
    if (!firstDay) return;

    const month = new Date(firstDay.date + "T00:00:00Z").getUTCMonth();

    if (month !== previousMonth) {
      const x = left + weekIndex * (cell + gap);
      monthLabels += `
        <text x="${x}" y="25" fill="#8B949E"
          font-size="12" font-family="Arial">${new Date(firstDay.date + "T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" })}</text>`;
      previousMonth = month;
    }
  });

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" rx="18" fill="#0D1B35" stroke="#264A78"/>
    <rect x="20" y="20" width="5" height="${height - 40}" rx="3" fill="#60A5FA"/>
    <text x="40" y="35" fill="#58A6FF" font-size="17" font-weight="bold" font-family="Arial" letter-spacing="2">CONTRIBUTION ACTIVITY</text>
    <text x="40" y="45" fill="#C9D1D9" font-size="10" font-family="Arial"></text>
    ${monthLabels}
    ${squares}
    <text x="40" y="${height - 18}" fill="#8B949E" font-size="12" font-family="Arial">${total} contributions · Rolling 12-month view</text>
  </svg>`;

  writeSVG("contributions.svg", svg);
}

function buildStatsSVG({ repos, followers, stars, contributions }) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="210" viewBox="0 0 1000 210">
    <rect width="1000" height="210" rx="18" fill="#0D1B35" stroke="#264A78"/>
    <rect x="22" y="22" width="5" height="166" rx="3" fill="#60A5FA"/>
    <text x="42" y="42" fill="#58A6FF" font-size="18" font-weight="bold" font-family="Arial" letter-spacing="2">GITHUB / LIVE METRICS</text>
    <text x="42" y="68" fill="#C9D1D9" font-size="12" font-family="Arial">@${escapeHTML(USER)} · refreshed ${formatDate(new Date())}</text>

    ${[
      ["PUBLIC REPOSITORIES", repos],
      ["FOLLOWERS", followers],
      ["TOTAL STARS", stars],
      ["CONTRIBUTIONS · 1 YEAR", contributions],
    ].map((item, i) => `
      <rect x="${42 + i * 235}" y="90" width="220" height="90" rx="14" fill="#102644" stroke="#264A78"/>
      <text x="${56 + i * 235}" y="118" fill="#8DBBFF" font-size="11" font-family="Arial">${item[0]}</text>
      <text x="${56 + i * 235}" y="157" fill="#FFFFFF" font-size="29" font-weight="bold" font-family="Arial">${item[1]}</text>
    `).join("")}
  </svg>`;
}

function buildLanguagesSVG(languages) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  const entries = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const colors = [
    "#3178C6", "#6F42C1", "#F1E05A", "#3572A5",
    "#E34C26", "#563D7C", "#00ADD8", "#89E051"
  ];

  const percentages = entries.map(([name, bytes]) => ({
    name,
    percentage: total ? (bytes / total) * 100 : 0,
  }));

  let bar = "";
  let x = 40;

  percentages.forEach((entry, i) => {
    const segmentWidth = 920 * entry.percentage / 100;
    bar += `<rect x="${x}" y="92" width="${segmentWidth}" height="18" fill="${colors[i % colors.length]}"/>`;
    x += segmentWidth;
  });

  const labels = percentages.map((entry, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const lx = 40 + col * 310;
    const ly = 145 + row * 30;

    return `
      <circle cx="${lx}" cy="${ly}" r="6" fill="${colors[i % colors.length]}"/>
      <text x="${lx + 16}" y="${ly + 4}" fill="#C9D1D9" font-size="12" font-family="Arial">${escapeHTML(entry.name)}</text>
      <text x="${lx + 205}" y="${ly + 4}" fill="#8DBBFF" font-size="12" text-anchor="end" font-family="Arial">${entry.percentage.toFixed(1)}%</text>`;
  }).join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="250" viewBox="0 0 1000 250">
    <rect width="1000" height="250" rx="18" fill="#0D1B35" stroke="#264A78"/>
    <rect x="22" y="22" width="5" height="206" rx="3" fill="#60A5FA"/>
    <text x="42" y="42" fill="#58A6FF" font-size="18" font-weight="bold" font-family="Arial" letter-spacing="2">LANGUAGES / REPOSITORY BREAKDOWN</text>
    <text x="42" y="64" fill="#C9D1D9" font-size="12" font-family="Arial">Aggregated from public repository language data</text>
    ${bar}
    ${labels}
  </svg>`;
}

function replaceSection(readme, startMarker, endMarker, content) {
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);

  if (start === -1 || end === -1 || end < start) {
    console.warn(`README markers not found: ${startMarker}`);
    return readme;
  }

  return readme.slice(0, start + startMarker.length)
    + "\n" + content + "\n"
    + readme.slice(end);
}

async function main() {
  console.log(`Updating profile for ${USER}`);

  const profile = await github(`https://api.github.com/users/${USER}`);

  const repos = await github(
    `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`
  );

  const publicRepos = repos.filter(repo => !repo.fork);
  const stars = publicRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 1);

  const contributionData = await graphql(`
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `, {
    login: USER,
    from: from.toISOString(),
    to: now.toISOString(),
  });

  const collection = contributionData.user.contributionsCollection;
  const calendar = collection.contributionCalendar;
  const days = calendar.weeks.flatMap(week => week.contributionDays);

  const languageTotals = {};

  for (const repo of publicRepos) {
    try {
      const languages = await github(repo.languages_url);
      for (const [language, bytes] of Object.entries(languages)) {
        languageTotals[language] = (languageTotals[language] || 0) + bytes;
      }
    } catch (error) {
      console.warn(`Skipping language data for ${repo.name}: ${error.message}`);
    }
  }

  writeSVG("github-stats.svg", buildStatsSVG({
    repos: profile.public_repos,
    followers: profile.followers,
    stars,
    contributions: collection.totalContributions,
  }));

  writeSVG("top-languages.svg", buildLanguagesSVG(languageTotals));
  buildCalendarSVG(days);

  const recent = publicRepos
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  const recentContent = recent.map(repo => {
    const description = escapeHTML(repo.description || "No description provided.");
    return `- [**${escapeHTML(repo.name)}**](${repo.html_url}) — ${description}`;
  }).join("\n");

  if (fs.existsSync(README_PATH)) {
    let readme = fs.readFileSync(README_PATH, "utf8");

    readme = replaceSection(
      readme,
      "<!-- RECENT-REPOS:START -->",
      "<!-- RECENT-REPOS:END -->",
      recentContent
    );

    fs.writeFileSync(README_PATH, readme, "utf8");
  }

  console.log("Profile data generated successfully.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
