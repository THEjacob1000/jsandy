import { Primitive } from "@jsandy/ui/primitive";
import { useLayoutEffect } from "@jsandy/ui/use-layout-effect";
import * as React from "react";
import ReactDOM from "react-dom";

/* -------------------------------------------------------------------------------------------------
 * Portal
 * -----------------------------------------------------------------------------------------------*/

const PORTAL_NAME = "Portal";

type PortalElement = React.ComponentRef<typeof Primitive.div>;
type PrimitiveDivProps = React.ComponentPropsWithoutRef<typeof Primitive.div>;
interface PortalProps extends PrimitiveDivProps {
	/**
	 * An optional container where the portaled content should be appended.
	 */
	container?: Element | DocumentFragment | null;
}

const Portal = React.forwardRef<PortalElement, PortalProps>(
	(props, forwardedRef) => {
		const { container: containerProp, ...portalProps } = props;
		const [mounted, setMounted] = React.useState(false);
		useLayoutEffect(() => setMounted(true), []);
		const container = containerProp || (mounted && globalThis?.document?.body);
		return container
			? ReactDOM.createPortal(
					<Primitive.div {...portalProps} ref={forwardedRef} />,
					container,
				)
			: null;
	},
);

Portal.displayName = PORTAL_NAME;

/* -----------------------------------------------------------------------------------------------*/

export { Portal };
export type { PortalProps };
