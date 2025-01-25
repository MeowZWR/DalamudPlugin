const fs = require("fs");

const extraTag = "Sea Of Stars";
const specifiedPlugins = [
  "Penumbra",
  "Glamourer",
  "SimpleHeels",
  "CustomizePlus",
  "Ktisis",
  "Brio",
  "DynamicBridge",
  "Moodles",
];
const reposMeta = JSON.parse(fs.readFileSync("./meta.json", "utf8"));
const targetApiLevel = 10;
const final = [];

function recoverPlugin(internalName) {
  if (!fs.existsSync("./repo.json")) {
    console.error("!!! repo.json not found when recovering plugin");
    return;
  }

  const oldRepo = JSON.parse(fs.readFileSync("./repo.json", "utf8"));
  const plugin = oldRepo.find((x) => x.InternalName === internalName);
  if (plugin) {
    final.push(plugin);
    console.log(`Recovered ${internalName} from repo.json`);
  } else {
    console.error(`!!! Plugin "${internalName}" not found in repo.json`);
  }
}

async function doRepo(url, plugins) {
  try {
    console.log(`Fetching ${url}...`);
    const repo = await fetch(url, {
      headers: { "user-agent": "SeaOfStars/1.0.0" },
    }).then((res) => res.json());

    plugins.forEach((internalName) => {
      const plugin = repo.find((x) => x.InternalName === internalName);
      if (!plugin) {
        console.warn(`!!! Plugin "${internalName}" not found in ${url}`);
        recoverPlugin(internalName);
        return;
      }

      if (plugin.DalamudApiLevel !== targetApiLevel) {
        console.warn(
          `!!! ${internalName} has DalamudApiLevel ${plugin.DalamudApiLevel}, skipping`
        );
        recoverPlugin(internalName);
        return;
      }

      if (specifiedPlugins.includes(internalName)) {
        plugin.Tags = [...(plugin.Tags || []), extraTag];
        console.log(`Added tag "${extraTag}" to ${internalName}`);
      }

      final.push(plugin);
    });
  } catch (error) {
    console.error(`!!! Failed to fetch ${url}`, error);
    plugins.forEach(recoverPlugin);
  }
}

async function main() {
  for (const meta of reposMeta) {
    await doRepo(meta.repo, meta.plugins);
  }

  // Clean the final array to remove "https://meowrs.com/"
  const cleanedFinal = final.map((plugin) => {
    const cleanedPlugin = { ...plugin };
    Object.keys(cleanedPlugin).forEach((key) => {
      if (typeof cleanedPlugin[key] === "string") {
        cleanedPlugin[key] = cleanedPlugin[key].replace(
          /https:\/\/meowrs.com\//g,
          ""
        );
      }
    });
    return cleanedPlugin;
  });

  // Write to meowrs.json
  fs.writeFileSync("./meowrs.json", JSON.stringify(final, null, 2)); // Final unchanged data
  console.log(`Wrote ${final.length} plugins to meowrs.json.`);

  // Write to repo.json with cleaned URLs
  fs.writeFileSync("./repo.json", JSON.stringify(cleanedFinal, null, 2));
  console.log(`Wrote ${cleanedFinal.length} plugins to repo.json.`);
}

main();
