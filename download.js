/*
TODO: Better error catching and simplify both test cases and codebase.
*/

import fs from "fs-extra";
import readLine from "readline";
import fetch from "node-fetch";
import crypto from "crypto";
import colorIt from "color-it";
import defaultData from "./edit_here_to_add_blocklists.json" assert { type: "json" };
import { execSync } from "child_process";
const { createWriteStream, createReadStream } = fs;
const DOWNLOAD_FOLDER = "./downloaded_files/";
const CONFIG_FOLDER = "./config/";
const CF_FOLDER = "./custom_filters/";
const PROCESSING_FOLDER = "./processed_files/";
const SOURCE_FOLDER = "./sources/";
const MAX_ATTEMPTS = 3;
/* Does the regex work? Yes! 
  Can it be improved further? Yes, of course!
  */
const firstReplace = /^([-._!&=?~#]|.*[\[/$@>]|[^\s*]+\*).*$/
const secondReplace = /(^#\S*)|(^[\d.:]+[\s\t]+)|(^::1[\s\t]+)/;
const domainMatch = /^(([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}|xn--[\w-]+)$/;

async function downloadFiles() {
  console.log("" + colorIt(`Starting downloadFiles function`).indigo());

  let urlSources = defaultData.blocklistConfig.flatMap((d) => d.url);

  // Get unique urls from the list as urls can be repeated and used in multiple places.
  let uniqueUrlSources = Array.from(new Set(urlSources));

  try {
    await fs.mkdir(DOWNLOAD_FOLDER, { recursive: true });

    console.log("Total number of lists to download and process : " + uniqueUrlSources.length);
    console.log(`Attempting to download files, only files failed to download will be logged`);

    const downloadPromises = uniqueUrlSources.map(async (url) => {
      let file_name = `i_${crypto.createHash("md5").update(url).digest("hex")}`;
      let attempts = 0;
      while (attempts < MAX_ATTEMPTS) {
        try {
          const response = await fetch(url, { method: "GET" });

          if (response.ok) {
            await new Promise((resolve, reject) => {
              response.body
                .pipe(createWriteStream(path.join(DOWNLOAD_FOLDER, file_name), { flags: "w" }))
                .on("finish", resolve)
                .on("error", reject);
            });
            break;
          }
        } catch (error) {
          console.log(`Attempt ${attempts + 1} failed to download ${url}`);
        }
        attempts++;
      }
      if (attempts === MAX_ATTEMPTS) {
        console.log("" + colorIt(`Failed to download ${url} after ${MAX_ATTEMPTS} attempts`).redBg());
      }
    });

    await Promise.all(downloadPromises);
    console.log(`Downloaded all files`);
    console.log("" + colorIt(`Finished downloadFiles function`).green());
    console.log("------------------------------------------------\n");
  } catch (error) {
    console.log(error);
  }
}

async function processFiles() {
  console.log("" + colorIt(`Starting processFiles function`).indigo());

  if (!fs.existsSync(DOWNLOAD_FOLDER)) {
    console.log("Folder does not exist");
    process.exit(1);
  }
  // remove the folder if it exists as we always append the data to the file.
  if (fs.existsSync(PROCESSING_FOLDER)) {
    await fs.remove(PROCESSING_FOLDER);
  }
  // create tmp folder for processing files
  !fs.existsSync(PROCESSING_FOLDER) && fs.mkdirSync(PROCESSING_FOLDER);

  // There aren't any subfolders present in this directory.
  let files = await fs.readdir(DOWNLOAD_FOLDER);

  console.log(`Found ${files.length} files in directory`);

  for (const file of files) {
    await processLineByLine(file);
  }
  console.log(`Finished processing files`);
  console.log("" + colorIt(`Finished processFiles function`).green());
  console.log("------------------------------------------------\n");
}
//  https://stackoverflow.com/a/32599033
async function processLineByLine(file) {
  const fileStream = createReadStream(path.join(DOWNLOAD_FOLDER, file));
  const writeStream = createWriteStream(path.join(PROCESSING_FOLDER, file), { flags: "a" });

  const rl = readLine.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    let data = line.replace(firstReplace, "").replace(secondReplace, "").match(domainMatch);
    if (data) {
      writeStream.write(data[0] + "\n");
    }
  }
  writeStream.end();
}

async function copyFiles() {
  console.log("" + colorIt(`Starting copyFiles function`).indigo());

  await fs.mkdir(CF_FOLDER, { recursive: true });
  const files = fs.readdirSync(PROCESSING_FOLDER);
  for (const file of files) {
    execSync(`cat ${path.join(PROCESSING_FOLDER, file)} | sort | uniq > ${path.join(CF_FOLDER, file)}`);
  }

  console.log("" + colorIt(`Finished copyFiles function`).green());
  console.log("------------------------------------------------\n");
}

async function generateConfigs() {
  console.log("" + colorIt(`Starting generateConfigs function`).indigo());

  fs.mkdirSync(CONFIG_FOLDER, { recursive: true });
  if (fs.existsSync(SOURCE_FOLDER)) {
    fs.removeSync(SOURCE_FOLDER);
  }
  fs.mkdirSync(SOURCE_FOLDER, { recursive: true });

  var cusFil = [];
  var conn = {
    adblock: [],
    adultfilter: [],
  };
  var fileHashes = {};

  var dataBlocklist = defaultData.blocklistConfig;
  var dataAdblock = dataBlocklist.filter((dataBlocklist) => defaultData.adblockConfig.includes(dataBlocklist.value));
  var dataAdult = dataBlocklist.filter((dataBlocklist) => defaultData.adultfilterConfig.includes(dataBlocklist.value));

  for (let blocklist of dataAdblock) {
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      conn.adblock.push(
        `i_${crypto
          .createHash("md5")
          .update(url + "+" + filterType)
          .digest("hex")}`
      );
    }
  }
  for (let blocklist of dataAdult) {
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      conn.adultfilter.push(
        `i_${crypto
          .createHash("md5")
          .update(url + "+" + filterType)
          .digest("hex")}`
      );
    }
  }

  for (let blocklist of dataBlocklist) {
    let total = 0;
    let id = "id" + blocklist.value;
    var conn_arr = [];
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      let flHa = `i_${crypto.createHash("md5").update(url).digest("hex")}`;
      fileHashes[flHa] = url;
      conn_arr.push(
        `i_${crypto
          .createHash("md5")
          .update(url + "+" + filterType)
          .digest("hex")}`
      );
      await fs.promises.appendFile(SOURCE_FOLDER + id + ".md", `## ${url}\n`);
      await countLines(CF_FOLDER + flHa)
        .then((lineCount) => {
          total += lineCount;
        })
        .catch((err) => {
          console.error(err);
        });
    }
    conn[id] = conn_arr;
    blocklist.totalDomains = total;
    blocklist.source = "https://github.com/dnswarden/blocklist-staging/blob/main/sources/" + id + ".md";
    cusFil.push(blocklist);
  }
  conn["discard"] = ["discard"];
  conn["uncensored"] = ["uncensored"];

  await fs.promises.writeFile(CONFIG_FOLDER + "hashes.json", JSON.stringify(fileHashes), "utf8");
  await fs.promises.writeFile(CONFIG_FOLDER + "conn.json", JSON.stringify(conn), "utf8");

  await fs.promises.writeFile(CONFIG_FOLDER + "customfilter.json", JSON.stringify(cusFil), "utf8");

  console.log("" + colorIt(`Finished generateConfigs function`).green());
  console.log("------------------------------------------------\n");
}

function countLines(filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const fileStream = createReadStream(filePath);
    const rl = readLine.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    rl.on("line", () => {
      lineCount++;
    });
    rl.on("close", () => {
      resolve(lineCount);
    });
    rl.on("error", (err) => {
      reject(err);
    });
  });
}

async function checkFiles() {
  console.log("" + colorIt(`Starting checkFiles function`).indigo());
  let hashes;
  try {
    const data = fs.readFileSync(CONFIG_FOLDER + "hashes.json", "utf-8");
    hashes = JSON.parse(data);
  } catch (err) {
    console.error(err);
  }
  let hashes_arr = Object.keys(hashes);

  const files = fs.readdirSync(CF_FOLDER);
  const toAdd = hashes_arr.filter((element) => !files.includes(element));
  const toRemove = files.filter((element) => !hashes_arr.includes(element));

  for (let x in toAdd) {
    fs.writeFileSync(CF_FOLDER + toAdd[x], `some.invalid.domain`);
  }

  for (let y in toRemove) {
    fs.removeSync(CF_FOLDER + toRemove[y]);
  }
  console.log("" + colorIt(`Finished checkFiles function`).green());
  console.log("------------------------------------------------\n");
}

async function updateHistory() {
  console.log("" + colorIt(`Starting updateHistory function`).indigo());

  let totalLines = 0;

  const files = fs.readdirSync(CF_FOLDER);
  for (let file of files) {
    const readStream = createReadStream(path.join(CF_FOLDER, file));
    const rl = readLine.createInterface({
      input: readStream,
      crlfDelay: Infinity,
    });

    for await (const _ of rl) {
      totalLines++;
    }
  }

  const dateUTC = new Date().toUTCString();
  const string = `Updated at : ${dateUTC} , total domains in repo : ${totalLines}\n`;

  fs.appendFileSync("./update_history.txt", string);
  console.log("" + colorIt(`Finished updateHistory function`).green());
  console.log("------------------------------------------------\n");
}

async function testValue() {
  console.log("" + colorIt(`Starting testValue function`).indigo());
  const dataBL = defaultData.blocklistConfig;
  const dataAdblock = defaultData.adblockConfig;
  const dataAdult = defaultData.adultfilterConfig;

  const values = new Set();
  for (let i = 0; i < dataBL.length; i++) {
    if (dataBL[i].value > dataBL.length) {
      console.log("" + colorIt("found value greater than index size at \n").red());
      console.log(dataBL[i]);
      process.exit(1);
    }
    if (values.has(dataBL[i].value)) {
      console.log("" + colorIt("Quitting after finding first instance of repetition at\n").red());
      console.log(dataBL.filter((el) => el.value === dataBL[i].value));
      process.exit(1);
    }
    values.add(dataBL[i].value);
  }

  for (let x in dataAdblock) {
    if (dataAdblock[x] > dataBL.length) {
      console.log("" + colorIt(`Found value greater than blocklist index in adblock config ${dataAdblock[x]}`).red());
      process.exit(1);
    }
  }

  for (let x in dataAdult) {
    if (dataAdult[x] > dataBL.length) {
      console.log("" + colorIt(`Found value greater than blocklist index in adult filter config ${dataAdult[x]}`).red());
      process.exit(1);
    }
  }
  console.log("" + colorIt(`Finished testValue function`).green());
  console.log("------------------------------------------------\n");
}

async function testCore() {
  console.log("" + colorIt(`Starting testCore function`).indigo());

  const dataBL = defaultData.blocklistConfig;
  const validFilterTypeValues = ["b-wild", "b-norm", "white", "fss"];

  dataBL.forEach((blocklist) => {
    if (blocklist.url.length !== blocklist.filterType.length) {
      console.log("" + colorIt("Mismatch url and filtertype length. Missing parameters at \n").red());
      console.log(blocklist);
      process.exit(1);
    }
    blocklist.filterType.forEach((filterType) => {
      if (!validFilterTypeValues.includes(filterType)) {
        console.log("" + colorIt("Invalid filter type value found at \n").red());
        console.log(blocklist);
        process.exit(1);
      }
    });

    if (typeof blocklist.enabled !== "boolean") {
      console.log("Found invalid boolean value : ", blocklist);
      process.exit(1);
    }
  });

  console.log("" + colorIt(`Finished testCore function`).green());
  console.log("------------------------------------------------\n");
}

async function testURLs() {
  console.log("" + colorIt(`Starting url checks`).indigo());
  let failed = 0;
  const dataBL = defaultData.blocklistConfig;
  const testUrls = dataBL.flatMap((blocklist) =>
    blocklist.url.map(async (url) => {
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.status !== 200) {
          console.log("" + colorIt(`Error: ${res.status} for ${url}`).redBg());
          failed += 1;
        }
      } catch (err) {
        console.log("" + colorIt(`Error: ${err} for ${url}`).redBg());
        failed += 1;
      }
    })
  );

  await Promise.all(testUrls);

  if (failed > 0) {
    console.log(`${failed} number of urls failed`);
    // we can enable this later on
    process.exit(1);
  } else {
    console.log("" + colorIt(`All URLs are working`).green());
  }
  console.log("------------------------------------------------\n");
}

async function generateRegexData() {
  if (!fs.existsSync("./test_data/input.txt")) {
    console.log("Test data file doesn't exist");
    process.exit(1);
  }
  const fileStream = createReadStream("./test_data/input.txt");
  const writeStream = createWriteStream("./test_data/output.txt", { flags: "w" });

  const rl = readLine.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    let data = line.replace(firstReplace, "").replace(secondReplace, "").match(domainMatch);
    if (data) {
      writeStream.write(data[0] + "\n");
    }
  }
  writeStream.end();
}

async function checkRegex() {
  const fileStream = createReadStream("./test_data/input.txt");
  const writeStream = createWriteStream("./test_data/test.txt", { flags: "w" });

  const rl = readLine.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    let data = line.replace(firstReplace, "").replace(secondReplace, "").match(domainMatch);
    if (data) {
      writeStream.write(data[0] + "\n");
    }
  }
  writeStream.end(() => {
    const originalFile = fs.readFileSync("./test_data/output.txt");
    const testFile = fs.readFileSync("./test_data/test.txt");

    const originalHash = crypto.createHash("md5").update(originalFile).digest("hex");
    const testHash = crypto.createHash("md5").update(testFile).digest("hex");

    console.log(`Original File: ${originalHash}`);
    console.log(`Test File: ${testHash}`);
    if (originalHash === testHash) {
      console.log(`${originalHash} and ${testHash} are identical`);
    } else {
      console.log(`${originalHash} and ${testHash} are different`);
      process.exit(1);
    }
  });
}

async function main() {
  await downloadFiles();
  await processFiles();
  await copyFiles();
  await generateConfigs();
  await checkFiles();
  await updateHistory();
}
export { processFiles, downloadFiles, copyFiles, generateConfigs, checkFiles, updateHistory, testValue, testCore, testURLs, generateRegexData, checkRegex, main };
