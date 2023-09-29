/**
 * Converts a kebab-case string to PascalCase.
 * For example, "my-example-string" becomes "myExampleString".
 * @param input The kebab-case string to convert.
 * @returns The converted PascalCase string.
 */
export function kebabCaseToPascalCase(input: string) {
	const converted = input.replace(/-([a-z])/g, function (match, letter) {
		return letter.toUpperCase();
	});
	return converted.charAt(0).toUpperCase() + converted.slice(1);
}

/**
 * Converts a kebab-case string to pascalCase.
 * For example, "my-example-string" becomes "myExampleString".
 * @param input The kebab-case string to convert.
 * @returns The converted pascalCase string.
 */
export function pascalCaseToKebabCase(input: string) {
	return input.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
