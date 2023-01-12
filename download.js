/*
TODO: Better error catching and simplify both test cases and codebase.
*/

import fs from "fs-extra";
import readLine from "readline";
import fetch from "node-fetch";
import crypto from "crypto";
import colorIt from "color-it";
import defaultData from "./edit_here_to_add_blocklists.json" assert { type: "json" };
const { createWriteStream, createReadStream } = fs;

async function downloadFiles() {
  let urlSources = [];

  for (let x in defaultData.blocklistConfig) {
    for (let y in defaultData.blocklistConfig[x].url)
      urlSources.push(defaultData.blocklistConfig[x].url[y]);
  }

  let uniqueUrlSources = Array.from(new Set(urlSources));

  fs.mkdirSync(`./downloaded_files/`, { recursive: true });

  console.log(
    "Total number of lists to download and process : " + uniqueUrlSources.length
  );

  const downloadPromises = uniqueUrlSources.map(async (url) => {
    let file_name = crypto.createHash("md5").update(url).digest("hex");
    console.log(`Downloading ${url}`);
    try {
      const response = await fetch(url, { method: "GET" });

      if (!response.ok) {
        console.log(
          "" +
            colorIt(`Failed to download ${url} ${response.statusText}`).redBg()
        );
      }

      if (response.ok) {
        response.body.pipe(
          createWriteStream("./downloaded_files/" + file_name, {
            flags: "w",
          })
        );
        console.log(`Saved file as ${file_name}`);
      }
    } catch (error) {
      console.log("" + colorIt(`Failed to download ${url} `).redBg() + error);
    }
  });

  await Promise.all(downloadPromises);
}

async function processFiles() {
  if (!fs.existsSync(`./downloaded_files/`)) {
    console.log("Folder does not exist");
    process.exit(1);
  }
  // removing this folder if it exists as we always append the data to the file.
  if (fs.existsSync(`./processed_files/`)) {
    fs.removeSync(`./processed_files/`);
  }
  // create tmp folder for processing files
  !fs.existsSync(`./processed_files/`) && fs.mkdirSync(`./processed_files/`);

  let file_name = fs
    .readdirSync("./downloaded_files/", { withFileTypes: true })
    .filter((file) => !file.isDirectory())
    .map((file) => file.name);
  console.log(`Found ${file_name.length} files in directory`);

  for (let x in file_name) {
    processLineByLine(file_name[x]);
  }
}

//  https://stackoverflow.com/a/32599033
async function processLineByLine(fl) {
  const fileStream = createReadStream("./downloaded_files/" + fl);
  const WS = createWriteStream(`./processed_files/` + fl, { flags: "a" });

  const rl = readLine.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  /* Does the regex work? Yes! 
  Can it be improved further? Yes, of course!
  */
  for await (const line of rl) {
    var str = line;
    var data = str
      .replace(
        /(^[-\._!/:&=?~#].*$)|(^.*[\[\$/@>].*$)|(^.*[a-zA-Z0-9-_^/]+#.*$)|(.+\*.*$)/gim,
        ""
      )
      .replace(/(#.*$)|(^\*\.)/, "")
      .match(/((([a-zA-Z0-9-_]{1,})\.)+[a-zA-Z]{2,})/);

    if (data) {
      WS.write(data[0] + "\n");
    }
  }
  WS.end();
  console.log(`Finished writing ${fl}`);
}

async function copyFiles() {
  try {
    console.log("Attempting to copy files to custom_filter folder");
    await fs.copy("./processed_files/", "./custom_filters/");
    console.log("" + colorIt("Copied files successfully to folder!").greenBg());
  } catch (err) {
    console.error(
      "" + colorIt("Unable to copy files to folder!").redBg() + err
    );
  }
}

async function main() {
  await downloadFiles();
  await processFiles();
  await copyFiles();
}
downloadFiles()
export { processFiles, downloadFiles, copyFiles, main };
