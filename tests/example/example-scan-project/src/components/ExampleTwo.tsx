interface OwnProps {
	val: string;
	open: boolean;
}
export default function ExampleTwo(props: OwnProps) {
	return <span aria-hidden="true">ExampleTwo Val = {props.val}</span>;
}
