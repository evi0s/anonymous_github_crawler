#!/usr/bin/env ts-node

import axios, { AxiosResponse } from "axios";
import { promises } from "fs";

type TreeElement = Tree | TreeFile;

interface Tree {
    [key: string]: TreeElement;
}

interface TreeFile {
    size: number;
}

const getRandomInt = (min: number, max: number) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

const sleep = async (_t: number): Promise<void> => {
    return new Promise((resolve, _) => {
        setTimeout(() => {
            resolve();
        }, _t);
    });
}

const fetchUrlFromCommandLine = (): string => {
    if (process.argv.length !== 3) {
        throw new Error(`[cmdline] invalid argument`);
    }
    return process.argv[2];
}

const crawler = async (path: string): Promise<AxiosResponse> => {
    try {
        return await axios
            .get(`https://anonymous.4open.science${path}`, {
                headers: {
                    "accept": "application/json, text/plain, */*",
                    // "accept-encoding": "gzip, deflate, br",
                    "accept-language": "en-US,en;q=0.9",
                    "cookie": "_ga=GA1.2.1832924814.1645409307; _gid=GA1.2.549999584.1647030574; _gat=1",
                    "referer": "https://anonymous.4open.science/r/Paper470/ReverseTool/package-lock.json",
                    "sec-ch-ua": `" Not A;Brand";v="99", "Chromium";v="99", "Google Chrome";v="99"`,
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": `"Linux"`,
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36"
                },
                decompress: true
            });
    } catch (err) {
        throw new Error(`[crawler] err in fetch file: ${path}, reason: ${err}`);
    }
}

const getRepoName = (url: string): string => {
    const repoUrl = new URL(url);
    const path = repoUrl.pathname;
    if (!path.startsWith("/r/")) {
        throw new Error(`[get path] error in repo path resolve`);
    }
    return path.split("/")[2];
}

const getRepoStructure = async (repoName: string): Promise<Tree> => {
    return (await crawler(`/api/repo/${repoName}/files`)).data as Tree;
}

const createFileTree = async (repoName: string, tree: Tree) => {
    const dist = `${process.cwd()}/${repoName}`;
    // create repo dir first at cwd
    await promises.mkdir(dist, {recursive: true});

    // walk tree
    await createRepoStructure(dist, tree);
}

const instanceOfTreeFile = (object: any): object is TreeFile => {
    return 'size' in object;
}

const createRepoStructure = async (path: string, tree: Tree) => {
    for (let element of Object.keys(tree)) {
        if (instanceOfTreeFile(tree[element])) {
            continue;
        }
        await createRepoStructure(`${path}/${element}`, <Tree> tree[element]);
    }
    await promises.mkdir(`${path}/`, { recursive: true });
}

const createFiles = async (repoName: string, tree: Tree) => {
    await downloadFile(repoName, "", tree);
}

const downloadFile = async (repoName: string, path: string, tree: Tree) => {
    for (let element of Object.keys(tree)) {
        if (!instanceOfTreeFile(tree[element])) {
            await downloadFile(repoName, `${path}/${element}`, <Tree> tree[element]);
            continue;
        }

        const dist = `${process.cwd()}/${repoName}/${path}/${encodeURI(element)}`;
        try {
            await promises.stat(dist)
        } catch (e) {
            console.log(`[downloader] downloading ${path}/${element} ...`);
            await promises.writeFile(dist,
                (await crawler(`/api/repo/${repoName}/file${path}/${element}`)).data);
            await sleep(getRandomInt(1000, 10000));
            continue;
        }
        console.log(`[downloader] file ${path}/${element} is already exist`);
    }
}


const main = async () => {
    try {
        const repoUrl = fetchUrlFromCommandLine();
        const repoName = getRepoName(repoUrl);
        const repoTree = await getRepoStructure(repoName);

        // create structure tree
        await createFileTree(repoName, repoTree);

        // download files
        await createFiles(repoName, repoTree);
    } catch (e) {
        console.error(`err: ${e}`);
    }
}


(async () => {
    await main();
})();
