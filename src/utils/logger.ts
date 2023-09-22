class VerboseLogger {
	verboseMode: boolean;
	constructor() {
		this.verboseMode = false;
	}

	setVerboseMode(verbose: boolean) {
		this.verboseMode = verbose;
	}

	log(message: any, ...optionalParams: any[]) {
		if (this.verboseMode) {
			console.log(message, ...optionalParams);
		}
	}

	isVerbose() {
		return this.verboseMode;
	}
}

const logger = new VerboseLogger();

export default logger;
