const fs = require("fs");

const extraTag = "Sea Of Stars";
const specifiedPlugins = ["Penumbra", "Glamourer", "SimpleHeels", "CustomizePlus", "Ktisis", "Brio", "DynamicBridge", "Moodles"];
const reposMeta = JSON.parse(fs.readFileSync("./meta.json", "utf8"));
const final = [];

const targetApiLevel = 10;

async function recoverPlugin(internalName) {
    if (!fs.existsSync("./repo.json")) {
        console.error("!!! Tried to recover plugin when repo isn't generated");
        process.exit(1);
    }

    const oldRepo = JSON.parse(fs.readFileSync("./meowrs.json", "utf8"));
    const plugin = oldRepo.find((x) => x.InternalName === internalName);
    if (!plugin) {
        console.error(`!!! ${plugin} not found in old repo`);
        process.exit(1);
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
        
    fs.writeFileSync("./meowrs.json", JSON.stringify(final, null, 2));
    console.log(`Wrote ${final.length} plugins to meowrs.json.`);

    const cleanedFinal = final.map(plugin => {
        const cleanedPlugin = { ...plugin };
        for (const key in cleanedPlugin) {
            if (typeof cleanedPlugin[key] === 'string') {
                cleanedPlugin[key] = cleanedPlugin[key].replace(/https:\/\/meowrs.com\//g, '');
            }
        }
        return cleanedPlugin;
    });

    fs.writeFileSync("./repo.json", JSON.stringify(cleanedFinal, null, 2));
    console.log(`Wrote ${cleanedFinal.length} plugins to repo.json.`);
}

main();
