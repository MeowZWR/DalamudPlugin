const fs = require("fs");

const extraTag = "Sea Of Stars";
const specifiedPlugins = ["Penumbra", "Glamourer", "SimpleHeels", "CustomizePlus", "Ktisis", "Brio", "DynamicBridge", "Moodles"];
const reposMeta = JSON.parse(fs.readFileSync("./meta.json", "utf8"));
const final = [];

const targetApiLevel = 14;

// Get the total download count for a GitHub repo's releases
async function getDownloadCount(repoUrl) {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match) throw new Error('Invalid GitHub repository URL: ' + repoUrl);
    const [owner, repo] = [match[1], match[2].replace(/\.git$/, '')];

    let totalDownloads = 0, page = 1, hasMore = true;
    while (hasMore) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases?page=${page}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'SeaOfStars/1.0.0',
                ...(process.env.GITHUB_TOKEN && { Authorization: `token ${process.env.GITHUB_TOKEN}` })
            },
        });

        if (!response.ok) {
            if (response.status === 404) return 0;
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Output current API limit information
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const resetTime = response.headers.get('X-RateLimit-Reset');
        const resetTimeInUTC8 = new Date(resetTime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        console.log(`Remaining API calls: ${remaining}, reset at: ${resetTimeInUTC8}`);

        const releases = await response.json();
        if (releases.length === 0) {
            hasMore = false;
        } else {
            releases.forEach(release => release.assets.forEach(asset => {
                totalDownloads += asset.download_count;
            }));
            const linkHeader = response.headers.get('Link');
            hasMore = linkHeader?.includes('rel="next"') || false;
            page++;
        }
    }
    return totalDownloads;
}

async function recoverPlugin(internalName) {
    if (!fs.existsSync("../../global.json")) {
        console.error("!!! Tried to recover plugin when global.json isn't generated");
        process.exit(1);
    }

    const oldRepo = JSON.parse(fs.readFileSync("../../global.json", "utf8"));
    const plugin = oldRepo.find((x) => x.InternalName === internalName);
    if (!plugin) {
        console.error(`!!! ${internalName} not found in old repo`);
        process.exit(1);
    }
    // If DownloadCount already exists, keep the original value
    if (!plugin.DownloadCount) {
        plugin.DownloadCount = 0;
    }
    
    // Download count handling
    if (plugin.RepositoryUrl) {
        try {
            const downloadCount = await getDownloadCount(plugin.RepositoryUrl);
            plugin.DownloadCount = downloadCount;
            console.log(`Download count for ${internalName}: ${downloadCount}`);
        } catch (e) {
            console.error(`Failed to get download count for ${internalName}: ${e.message}`);
        }
    } else {
        console.warn(`No RepositoryUrl for ${internalName}, download count not available`);
    }

    final.push(plugin);
    console.log(`Recovered ${internalName} from last manifest`);
}

async function doRepo(url, plugins) {
    console.log(`Fetching ${url}...`);
    const repo = await fetch(url, {
        headers: {
            'user-agent': 'SeaOfStars/1.0.0',
        },
    }).then((res) => res.json());

    for (const internalName of plugins) {
        const plugin = repo.find((x) => x.InternalName === internalName);
        if (!plugin) {
            console.warn(`!!! ${plugin} not found in ${url}`);
            recoverPlugin(internalName);
            continue;
        }

        const repoUrl = plugin.RepoUrl || url.replace('/global.json', ''); 
        if (plugin.DalamudApiLevel !== targetApiLevel) {
            console.warn(`!!! ${internalName} has DalamudApiLevel ${plugin.DalamudApiLevel}, skipping`);
            recoverPlugin(internalName);
            continue;
        }

        //  extraTag
        if (specifiedPlugins.includes(internalName)) {
            const tags = plugin.Tags || [];
            tags.push(extraTag);
            plugin.Tags = tags;
            console.log(`Added tag "${extraTag}" to ${internalName}`);
        }

        // Get download count
        if (repoUrl) {
            try {
                const downloadCount = await getDownloadCount(repoUrl);
                plugin.DownloadCount = downloadCount;
                console.log(`Download count for ${internalName}: ${downloadCount}`);
            } catch (e) {
                console.error(`Failed to get download count for ${internalName}: ${e.message}`);
                plugin.DownloadCount = 0;
            }
        } else {
            console.warn(`No RepoUrl for ${internalName}, download count not available`);
            plugin.DownloadCount = 0;
        }

        final.push(plugin);
    }
}

async function main() {
    for (const meta of reposMeta) {
        try {
            await doRepo(meta.repo, meta.plugins);
        } catch (e) {
            console.error(`!!! Failed to fetch ${meta.repo}`);
            console.error(e);
            for (const plugin of meta.plugins) {
                recoverPlugin(plugin);
            }
        }
    }
        
    fs.writeFileSync("../../global.json", JSON.stringify(final, null, 2));
    console.log(`Wrote ${final.length} plugins to global.json.`);
}

main();
