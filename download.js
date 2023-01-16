/*
TODO: Better error catching and simplify both test cases and codebase.
*/

import fs from 'fs-extra';
import readLine from 'readline';
import fetch from 'node-fetch';
import crypto from 'crypto';
import colorIt from 'color-it';
import shelljs from 'shelljs';
import defaultData from './edit_here_to_add_blocklists.json' assert { type: 'json' };
const { createWriteStream, createReadStream } = fs;
const DOWNLOAD_FOLDER = './downloaded_files/';
const CONFIG_FOLDER = './config/';
const CF_FOLDER = './custom_filters/';
const PROCESSING_FOLDER = './processed_files/';
const SOURCE_FOLDER = './sources/';
const MAX_ATTEMPTS = 3;

async function downloadFiles() {
  let urlSources = [];

  for (let x in defaultData.blocklistConfig) {
    for (let y in defaultData.blocklistConfig[x].url) urlSources.push(defaultData.blocklistConfig[x].url[y]);
  }

  // Get unique urls from the list as urls can be repeated and used in multiple places.
  let uniqueUrlSources = Array.from(new Set(urlSources));

  fs.mkdirSync(DOWNLOAD_FOLDER, { recursive: true });

  console.log('Total number of lists to download and process : ' + uniqueUrlSources.length);
  console.log(`Attempting to download files, only files failed to download will be logged`);

  const downloadPromises = uniqueUrlSources.map(async (url) => {
    let file_name = crypto.createHash('md5').update(url).digest('hex');
    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      try {
        const response = await fetch(url, { method: 'GET' });

        if (response.ok) {
          const writePromise = new Promise((resolve, reject) => {
            response.body
              .pipe(
                createWriteStream(DOWNLOAD_FOLDER + file_name, {
                  flags: 'w',
                })
              )
              .on('finish', resolve)
              .on('error', reject);
          });
          await writePromise;
          break;
        }
      } catch (error) {
        console.log(`Attempt ${attempts + 1} failed to download ${url}`);
      }
      attempts++;
    }
    if (attempts === MAX_ATTEMPTS) {
      console.log('' + colorIt(`Failed to download ${url} after ${MAX_ATTEMPTS} attempts`).redBg());
    }
  });

  await Promise.all(downloadPromises);
  console.log(`Downloaded all files`);
}

async function processFiles() {
  if (!fs.existsSync(DOWNLOAD_FOLDER)) {
    console.log('Folder does not exist');
    process.exit(1);
  }
  // removing this folder if it exists as we always append the data to the file.
  if (fs.existsSync(PROCESSING_FOLDER)) {
    fs.removeSync(PROCESSING_FOLDER);
  }
  // create tmp folder for processing files
  !fs.existsSync(PROCESSING_FOLDER) && fs.mkdirSync(PROCESSING_FOLDER);

  // There aren't any subfolders present in this directory.
  let file_name = fs.readdirSync(DOWNLOAD_FOLDER);

  console.log(`Found ${file_name.length} files in directory`);

  for (let x in file_name) {
    await processLineByLine(file_name[x]);
  }
  console.log(`Finished processing files`);
}

//  https://stackoverflow.com/a/32599033
async function processLineByLine(fl) {
  const fileStream = createReadStream(DOWNLOAD_FOLDER + fl);
  const WS = createWriteStream(PROCESSING_FOLDER + fl, { flags: 'a' });

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
      .replace(/(^[-\._!/:&=?~#].*$)|(^.*[\[\$/@>].*$)|(^.*[a-zA-Z0-9-_^/]+#.*$)|(.+\*.*$)/gim, '')
      .replace(/(#.*$)|(^\*\.)|(([0-9]{1,3}\.){3}[0-9]{1,3})([ \t]+)|((::)([ \t]+))|((::)+[1]([ \t]+))/, '')
      .match(/(^.*xn--.*$)|((([a-zA-Z0-9-_]{1,})\.)+[a-zA-Z]{2,})/);

    if (data) {
      WS.write(data[0] + '\n');
    }
  }
  WS.end();
}

async function copyFiles() {
  try {
    fs.mkdirSync(CF_FOLDER, { recursive: true });
    console.log('Attempting to copy files to custom_filter folder');
    fs.copySync(PROCESSING_FOLDER, CF_FOLDER);
    console.log('' + colorIt('Copied files successfully to folder!').greenBg());
  } catch (err) {
    console.error('' + colorIt('Unable to copy files to folder!').redBg() + err);
  }
}

async function generateConfigs() {
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
        crypto
          .createHash('md5')
          .update(url + '+' + filterType)
          .digest('hex')
      );
    }
  }
  for (let blocklist of dataAdult) {
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      conn.adultfilter.push(
        crypto
          .createHash('md5')
          .update(url + '+' + filterType)
          .digest('hex')
      );
    }
  }

  for (let blocklist of dataBlocklist) {
    let total = 0;
    let id = 'id' + blocklist.value;
    var conn_arr = [];
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      let flHa = crypto.createHash('md5').update(url).digest('hex');
      fileHashes[flHa] = url;
      conn_arr.push(
        crypto
          .createHash('md5')
          .update(url + '+' + filterType)
          .digest('hex')
      );
      await fs.promises.appendFile(SOURCE_FOLDER + id + '.md', `## ${url}\n`);
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
    blocklist.source = SOURCE_FOLDER + id + '.md';
    cusFil.push(blocklist);
  }

  await fs.promises.writeFile(CONFIG_FOLDER + 'hashes.json', JSON.stringify(fileHashes), 'utf8');
  await fs.promises.writeFile(CONFIG_FOLDER + 'conn.json', JSON.stringify(conn), 'utf8');

  await fs.promises.writeFile(CONFIG_FOLDER + 'customfilter.json', JSON.stringify(cusFil), 'utf8');
}

function countLines(filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const fileStream = fs.createReadStream(filePath);
    const rl = readLine.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    rl.on('line', () => {
      lineCount++;
    });
    rl.on('close', () => {
      resolve(lineCount);
    });
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

async function checkFiles() {
  let hashes;
  try {
    const data = fs.readFileSync(CONFIG_FOLDER + 'hashes.json', 'utf-8');
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
}

async function updateHistory() {
  const totalLines = parseInt(
    shelljs.exec(`wc -l ${CF_FOLDER}/* | grep total | sed 's/total//g'`, { silent: true }).stdout
  );
  const dateUTC = shelljs.exec('date -u', { silent: true }).stdout.trim();
  const string = `Updated at : ${dateUTC} , total domains in repo : ${totalLines}`;
  shelljs.echo(string).toEnd('./update_history.txt');
}
async function main() {
  await downloadFiles();
  await processFiles();
  await copyFiles();
  await generateConfigs();
  await checkFiles();
  await updateHistory();
}

export { processFiles, downloadFiles, copyFiles, generateConfigs, checkFiles, main };
