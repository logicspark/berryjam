import shell from "shelljs";
import { createReadStream, unlinkSync } from "fs";
import { createInterface } from "readline";
import { join } from "path";
import { createHomeDirIfNotExist } from "./file.utils";
import { ComponentProfile, FileProperty } from "../types";

export class GitService {
	createFileForModifiedGitType: Promise<boolean> = Promise.resolve(false);
	createFileForAllGitTypesExceptModified: Promise<boolean> =
		Promise.resolve(false);
	appDirectoryPath: string;
	filenameForModifiedGitType: string;
	filenameForAllGitTypesExceptModified: string;
	/**
	 * Create an instance of GitService.
	 *
	 * @param path - The path to the directory to scan for Git information.
	 * @param appPath - The path to the directory to store git information.
	 * @throws Throw an error if the git status does not equal to 0.
	 *
	 * Remark: For more detailed on how git log is filtered, please check --diff-filter section at https://git-scm.com/docs/git-log.
	 */
	constructor(path: string, appPath: string) {
		this.appDirectoryPath = createHomeDirIfNotExist(appPath);
		this.filenameForAllGitTypesExceptModified = join(
			this.appDirectoryPath,
			"git-log-for-all-except-modified.log"
		);
		this.filenameForModifiedGitType = join(
			this.appDirectoryPath,
			"git-log-for-modified.log"
		);
		this.gitScanner(path);
	}

	/**
	 * Initiate git log shell commands to scan which will be used by gitMapping.
	 *
	 */
	gitScanner(dir: string) {
		this.createFileForModifiedGitType = new Promise<boolean>((resolve) => {
			// Format to display datetime and author name
			shell.exec(
				`cd ${dir} && git log --name-only --diff-filter=M --pretty="format:DATETIME=%ai AUTHOR_NAME=%an" > ${this.filenameForModifiedGitType}`,
				{ silent: true, async: true },
				(code: number, stdout: string, stderr: string) => {
					if (code !== 0) {
						console.error(`Error executing command: ${stderr}`);
					}
					resolve(true);
				}
			);
		});

		this.createFileForAllGitTypesExceptModified = new Promise<boolean>(
			(resolve) => {
				// Format to display datetime and author name
				shell.exec(
					`cd ${dir} && git log --name-only --diff-filter=ACDRTUXB --pretty="format:DATETIME=%ai AUTHOR_NAME=%an" > ${this.filenameForAllGitTypesExceptModified}`,
					{ silent: true, async: true },
					(code: number, stdout: string, stderr: string) => {
						if (code !== 0) {
							console.error(`Error executing command: ${stderr}`);
						}
						resolve(true);
					}
				);
			}
		);
	}
	/**
	 * Asynchronously uses the result from reading of git log to map into each component profile.
	 * This function compares component name and git log filename. If both match, the git information will update into 
	 * the respective component profile.
	 *
	 * @returns A Promise that resolves an array of `Component Profile` objects, each representing a group
	 *          of git information with respective to each component profile.
	 */
	async gitMapping(tags: ComponentProfile[]): Promise<ComponentProfile[]> {
		try {
			await Promise.all([
				this.createFileForAllGitTypesExceptModified,
				this.createFileForModifiedGitType,
			]);
		} catch (error) {
			console.log(error, "[Func] gitMapping");
			return Promise.resolve([]);
		}

		for (let indexTag = 0; indexTag <= tags.length - 1; indexTag++) {
			const tag = tags[indexTag];
			if (!tag.source.property) {
				tag.source.property = {
					dataLastModified: "",
					lastModified: "",
					created: "",
					updatedBy: "",
					createdBy: "",
				};
			}
			if (tag.type == "internal") {
				try {
					const tagCreated: FileProperty = await this.createdFindBySource(
						tag.source.path
					);
					const tagUpdated: FileProperty = await this.updatedFindBySource(
						tag.source.path
					);

					tag.source.property.created =
						tagCreated.created ?? tagUpdated.lastModified;
					tag.source.property.createdBy =
						tagCreated.createdBy ?? tagUpdated.updatedBy;
					tag.source.property.lastModified =
						tagUpdated.lastModified ?? tagCreated.created;
					tag.source.property.dataLastModified =
						tagUpdated.dataLastModified ?? tagCreated.created;
					tag.source.property.updatedBy =
						tagUpdated.updatedBy ?? tagCreated.createdBy;
				} catch (error) {
					console.log(error, "[Func] gitMapping in the loop");
				}
			}
			tags[indexTag] = tag;
		} // End loop of updating tags
		return tags;
	}

	/**
	 * Check if this line is set with datetime and author name.
	 *
	 * @returns A boolean value indicates whether both `datetime` and `author name` exists or not.
	 */
	private isDateAndAuthorExisted(line: string) {
		return line.includes("DATETIME=") && line.includes("AUTHOR_NAME=");
	}

	/**
	 * Split textline to separate `datetime` and `author name` to create an object of git information for each component.
	 *
	 * @returns An object containing `datetime` and `author name`.
	 */
	private splitAndGetGitLog(line: string) {
		const splitedLine = line.replace("DATETIME=", "").split(" AUTHOR_NAME=");
		const datetime = new Date(splitedLine[0]);
		const authorName = splitedLine[1];
		return { datetime, authorName };
	}

	/**
	 * Find component source path to compare with git log filename for all types, excluding modified type,
	 * to collect git information for each component profile.
	 *
	 * @returns An object containing git information for each component profile.
	 */
	createdFindBySource(tagFilePath: string): Promise<FileProperty> {
		const result: FileProperty = {
			created: "",
			createdBy: "",
			dataLastModified: "",
			lastModified: "",
			updatedBy: "",
		};
		return new Promise((resolve) => {
			const readStream = createReadStream(
				this.filenameForAllGitTypesExceptModified,
				"utf-8"
			);
			const rl = createInterface({ input: readStream });
			let datetime = "";
			let authorName = "";
			rl.on("line", (line: string) => {
				if (line.length > 0) {
					if (this.isDateAndAuthorExisted(line)) {
						const log = this.splitAndGetGitLog(line);
						datetime = log.datetime.toDateString();
						authorName = log.authorName;
					} else {
						if (tagFilePath.includes(line)) {
							result.created = datetime;
							result.createdBy = authorName;
						}
					}
				}
			});
			rl.on("close", (_close: any) => {
				resolve(result);
			});
		});
	}
	
	/**
	 * Find component source path to compare with git log filename of modified type
	 * to collect git information for each component profile.
	 *
	 * @returns An object containing git information for each component profile.
	 */
	updatedFindBySource(tagFilePath: string): Promise<FileProperty> {
		const result: FileProperty = {
			created: "",
			createdBy: "",
			dataLastModified: "",
			lastModified: "",
			updatedBy: "",
		};
		return new Promise((resolve) => {
			const readStream = createReadStream(
				this.filenameForModifiedGitType,
				"utf-8"
			);
			const rl = createInterface({ input: readStream });
			let datetime = "";
			let authorName = "";
			rl.on("line", (line: string) => {
				if (line.length > 0) {
					if (this.isDateAndAuthorExisted(line)) {
						const log = this.splitAndGetGitLog(line);
						datetime = log.datetime.toDateString();
						authorName = log.authorName;
					} else {
						if (tagFilePath.includes(line)) {
							result.dataLastModified = datetime;
							result.lastModified = datetime;
							result.updatedBy = authorName;
						}
					}
				}
			});
			rl.on("close", (_close: any) => {
				resolve(result);
			});
		});
	}

	/**
	 * Remove a file containing git information if no longer needded (Not in use at the moment).
	 */
	unlinkGitLogFile() {
		unlinkSync(this.filenameForAllGitTypesExceptModified);
		unlinkSync(this.filenameForModifiedGitType);
	}

	/**
	 * Get Respository URL using a git command (Not in use at the moment).
	 *
	 * @returns A string or an empty value.
	 */
	getRepoUrl() {
		const { stdout, code } = shell.exec("git config --get remote.origin.url", {
			silent: true,
		});
		return code === 0 ? stdout.trim() : "";
	}
}
