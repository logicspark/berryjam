import { writeFile, existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname, basename, resolve } from "path";
import { glob } from "glob";

export const createHomeDirIfNotExist = (appHomeDirectory: string): string => {
	// create the app directory if it doesn't exist
	if (!existsSync(appHomeDirectory)) {
		mkdirSync(appHomeDirectory);
	}
	return appHomeDirectory;
};

export const getFileInfo = (filePath: string) => {
	const fileContent = readFileSync(filePath, "utf8");
	const fileName = basename(filePath);
	const currentDir = dirname(filePath);
	return {
		fileName,
		fileContent,
		currentDir,
	};
};

export const filterIgnoredDir = (
	filePaths: string[],
	dirNamePattern: RegExp[]
) => {
	return filePaths.filter((filePath: string) => {
		return (
			dirNamePattern.every((pattern) => !filePath.match(pattern)) &&
			!filePath.endsWith("package.json")
		);
	});
};

export function transformStringToRegex(s: string) {
	let regexString = s;
	if (s.startsWith(".") || s.endsWith(".")) {
		regexString = regexString.replace(/\./g, "\\.");
	}
	return new RegExp(regexString);
}

export async function getSupportedFiles(
	directory: string,
	ignorePatterns: string[]
): Promise<string[]> {
	const filePatterns = join(
		directory,
		"**",
		"*.{vue,js,json,ts,tsx,jsx}"
	).replace(/\\/g, "/");
	try {
		// scan file support file type .vue .js .ts .tsx .jsx
		let files: string[] = await glob(filePatterns);
		// let files:string[] = []
		if (files.length == 0) {
			return files;
		}
		// ignore directory
		files = filterIgnoredDir(files, ignorePatterns.map(transformStringToRegex));
		return files;
	} catch (error) {
		console.error(error);
		return [];
	}
}

export const writeResultToFile = (
	relativeFilePath: string,
	data: any
): Promise<string> => {
	const filePath = resolve(relativeFilePath);
	return new Promise<string>((resolve, reject) => {
		writeFile(filePath, JSON.stringify(data), (err) => {
			if (err) {
				console.error("Error saving file:", err);
				reject(err);
			} else {
				console.log(`File saved: ${filePath}`);
				resolve(filePath);
			}
		});
	});
};

export const checkFileTypeExists = (
	filePath: string,
	fileTypes: string[] = []
) => {
	const regexString = fileTypes.map((ele) => `(\\${ele})$`).join("|");
	const fileTypeRegex = new RegExp(regexString);
	if (fileTypes.length && !fileTypeRegex.test(filePath)) {
		const existsPath = fileTypes
			.map((ele) => `${filePath}${ele}`)
			.find((path) => existsSync(path));
		return {
			exists: !!existsPath,
			filePath: existsPath?.length ? existsPath : filePath,
		};
	}
	return { exists: existsSync(filePath), filePath };
};

export const writeGlobJson = (
	appHomeDirectory: string,
	data: string,
	filename = "data.json"
) => {
	const appDirectoryPath = createHomeDirIfNotExist(appHomeDirectory);
	const filePath = join(appDirectoryPath, filename);
	return new Promise<string>((resolve, reject) => {
		writeFile(filePath, data, (err) => {
			if (err) {
				console.error("Error saving file:", err);
				reject(err);
			} else {
				resolve(filePath);
			}
		});
	});
};

export const supportFileType = (): string[] => {
	return ["vue", "js", "json", "ts", "tsx", "jsx"];
};
