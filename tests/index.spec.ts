import { resolve } from "path";
import VueScanner from "../src/index";
import { homedir } from "os";
import { existsSync } from "fs";

describe("NPM Package", () => {
	it("should be an object", () => {
		expect(VueScanner).toBeInstanceOf(Object);
	});

	it("should have a VueScanner class", () => {
		// Check if VueScanner is a class constructor
		expect(typeof VueScanner).toBe("function");
		const appDir = `${homedir()}/.berryjam-test`;
		// You can also create an instance of VueScanner and test its methods or properties
		const scanner = new VueScanner(resolve(`${__dirname}/example`), {
			appDir,
		});
		expect(scanner).toBeInstanceOf(VueScanner);
		// You can now test methods and properties of the scanner instance
		expect(scanner.option.appDir).toBe(appDir);
		scanner.removeAppDir();
		const appDirExists = existsSync(appDir);
		expect(appDirExists).toBeFalsy();
	});
});
