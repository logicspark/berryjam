const removeDashesAndConvertToUpperCase = (text: string) => {
	return text.replace(/-/, "").toUpperCase();
};

export const kebabCaseToCamelCase = (text: string) => {
	return text.replace(/-\w/g, removeDashesAndConvertToUpperCase);
};

export const kebabCaseToPascalCase = (text: string) => {
	return text.replace(/(^\w|-\w)/g, removeDashesAndConvertToUpperCase);
};
