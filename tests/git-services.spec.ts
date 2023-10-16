import BabelParser from "@babel/parser";
import { GitService } from "../src/utils/git.services";
import { ParsedGitDiff } from "../src/interfaces/git.services.interfaces";

let resolvePath: string;
let appDir: string;
let gitService: GitService;

beforeEach(() => {
	resolvePath = `${__dirname}/example/`.replace(/\\/g, "/");
	appDir = `${__dirname}/example/`.replace(/\\/g, "/");
	gitService = new GitService(appDir, resolvePath);
});

/**
 * To recursively to search for all git commits.
 */
describe("Git recursively method", () => {
	it("should be a string", async () => {
		const received = gitService.executeCommand(
			`cd ${resolvePath} && git rev-parse HEAD`
		);
		expect(typeof received).toBe("string");
	});

	it("should be an object", async () => {
		const currentHash = gitService.executeCommand(
			`cd ${resolvePath} && git rev-parse HEAD`
		);
		let received: any = null;
		if (currentHash) {
			received = gitService.getCommitDetails(currentHash);
		}
		expect(received).toBeInstanceOf(Object);
	});

	it("should be a string", async () => {
		const currentHash = gitService.executeCommand(
			`cd ${resolvePath} && git rev-parse HEAD`
		);
		let received: any = null;
		if (currentHash) {
			received = gitService.getDiffDetails(currentHash);
		}
		expect(typeof received).toBe("string");
	});

	it("should be a string", async () => {
		const currentHash = gitService.executeCommand(
			`cd ${resolvePath} && git rev-parse HEAD`
		);
		let received: any = null;
		if (currentHash) {
			received = gitService.getPreviousCommitHash(currentHash);
		}
		expect(typeof received).toBe("string");
	});

	it("should have more than 0 object", async () => {
		const currentDate = new Date();
		const endDate = new Date();
		endDate.setMonth(currentDate.getMonth() - 12 * 10);

		const currentCommitHash = gitService.executeCommand(
			`cd ${resolvePath} && git rev-parse HEAD`
		);
		const received: ParsedGitDiff[] = [];
		if (currentCommitHash) {
			gitService.fetchCommits(received, currentCommitHash as string, endDate);
		}
		expect(received).not.toHaveLength(0);
	});
});

/**
 * To transform a string to an object by processing git parsed diff details.
 */
describe("Git parsed diff method", () => {
	it("should be an object", async () => {
		const currentDate = new Date();
		const endDate = new Date();
		endDate.setMonth(currentDate.getMonth() - 12 * 10);

		const currentCommitHash = gitService.executeCommand(
			`cd ${resolvePath} && git rev-parse HEAD`
		);
		const parsedGitDiff: ParsedGitDiff[] = [];
		if (currentCommitHash) {
			gitService.fetchCommits(
				parsedGitDiff,
				currentCommitHash as string,
				endDate
			);
		}
		const received = gitService.parseGitDiff(parsedGitDiff[0].diff);
		expect(received).toBeInstanceOf(Object);
	});
});
