import { type Context, Hono, type Next } from "hono";
import { env } from "hono/adapter";
import { HTTPException } from "hono/http-exception";
import type { Env, ErrorHandler, MiddlewareHandler, Schema } from "hono/types";
import type { StatusCode } from "hono/utils/http-status";
import { z, toJSONSchema, type ZodObject } from "zod/v4";
import { bodyParsingMiddleware, queryParsingMiddleware } from "./middleware";
import { IO, ServerSocket, type InferSchemaType } from "./sockets";
import type {
	ContextWithSuperJSON,
	GetOperation,
	InferInput,
	InferSchema,
	OperationType,
	PostOperation,
	RouterConfig,
	WebSocketOperation,
} from "./types";
import type { ClientRequest } from "./client";

/**
 * Utility type that flattens nested route structures into a flat key-value mapping
 * Converts nested route objects into flat paths with "/" separators
 * @template T - The route structure to flatten
 */
type FlattenRoutes<T> = {
	[K in keyof T]: T[K] extends WebSocketOperation<ZodObject, ZodObject>
		? { [P in `${string & K}`]: T[K] }
		: T[K] extends GetOperation<ZodObject | void>
			? { [P in `${string & K}`]: T[K] }
			: T[K] extends PostOperation<ZodObject | void>
				? { [P in `${string & K}`]: T[K] }
				: T[K] extends Record<string, unknown>
					? {
							[SubKey in keyof T[K] as `${string & K}/${string &
								SubKey}`]: T[K][SubKey] extends
								| WebSocketOperation<ZodObject, ZodObject>
								| GetOperation<ZodObject | void>
								| PostOperation<ZodObject | void>
								? T[K][SubKey]
								: never;
						}
					: never;
}[keyof T];

/**
 * Merges flattened routes into a single type mapping
 * @template T - The flattened routes structure
 */
export type MergeRoutes<T> = {
	[K in keyof FlattenRoutes<T>]: FlattenRoutes<T>[K];
};

/**
 * Generates schema definitions for router operations based on their types
 * Maps each operation to its corresponding HTTP method and data structure
 * @template T - The record of router operations
 */
export type RouterSchema<T extends Record<string, unknown>> = {
	[K in keyof T]: T[K] extends WebSocketOperation<ZodObject, ZodObject>
		? {
				$get: {
					input: InferInput<T[K]>;
					// biome-ignore lint/complexity/noBannedTypes: Empty object for output since WebSocket connections don't have an initial response payload
					output: {};
					incoming: NonNullable<T[K]["incoming"]>;
					outgoing: NonNullable<T[K]["outgoing"]>;
					outputFormat: "ws";
					status: StatusCode;
				};
			}
		: T[K] extends GetOperation<ZodObject | void>
			? {
					$get: {
						input: InferInput<T[K]>;
						output: ReturnType<T[K]["handler"]>;
						outputFormat: "json";
						status: StatusCode;
					};
				}
			: T[K] extends PostOperation<ZodObject | void>
				? {
						$post: {
							input: InferInput<T[K]>;
							output: ReturnType<T[K]["handler"]>;
							outputFormat: "json";
							status: StatusCode;
						};
					}
				: never;
};

/**
 * Infers the schema structure for a specific operation type
 * Used for type-safe client-server communication
 * @template T - The operation type to generate schema for
 * @template E - Environment type, defaults to Env
 */
export type OperationSchema<
	T,
	E extends Env = Env,
> = T extends WebSocketOperation<
	infer I extends ZodObject,
	infer O extends ZodObject
>
	? {
			$get: {
				input: z.infer<I>;
				output: z.infer<O>;
				incoming: z.infer<NonNullable<T["incoming"]>>;
				outgoing: z.infer<NonNullable<T["outgoing"]>>;
				outputFormat: "ws";
				status: StatusCode;
			};
		}
	: T extends GetOperation<ZodObject | void, Response, E>
		? {
				$get: {
					input: InferInput<T>;
					output: ReturnType<T["handler"]>;
					outputFormat: "json";
					status: StatusCode;
				};
			}
		: T extends PostOperation<ZodObject | void, Response, E>
			? {
					$post: {
						input: InferInput<T>;
						output: ReturnType<T["handler"]>;
						outputFormat: "json";
						status: StatusCode;
					};
				}
			: T extends ClientRequest<infer S>
				? S
				: never;

/**
 * Internal context interface for storing middleware outputs and parsed data
 */
interface InternalContext {
	/** Storage for middleware output data */
	__middleware_output?: Record<string, unknown>;
	/** Storage for parsed query parameters */
	__parsed_query?: Record<string, unknown>;
	/** Storage for parsed request body data */
	__parsed_body?: Record<string, unknown>;
}

/**
 * WebSocket bindings interface for Upstash Redis configuration
 */
interface WebSocketBindings {
	/** Upstash Redis REST API URL */
	UPSTASH_REDIS_REST_URL: string | undefined;
	/** Upstash Redis REST API authentication token */
	UPSTASH_REDIS_REST_TOKEN: string | undefined;
}

/**
 * JSON Schema interface for validation and documentation
 */
interface JSONSchema {
	/** JSON Schema type definition */
	type?: string | string[];
	/** Object property definitions */
	properties?: Record<string, JSONSchema>;
	/** Required property names */
	required?: string[];
	/** Additional properties configuration */
	additionalProperties?: boolean | JSONSchema;
	/** JSON Schema version identifier */
	$schema?: string;
}

/**
 * Metadata structure for GET and POST procedures
 */
type GetPostProcedureMetadata = {
	/** Operation type identifier */
	type: "get" | "post";
	/** JSON Schema for input validation, null if no schema */
	schema: JSONSchema | null;
};

/**
 * Metadata structure for WebSocket procedures
 */
type WSProcedureMetadata = {
	/** Operation type identifier */
	type: "ws";
	/** Schema definitions for incoming and outgoing messages */
	schema: {
		/** JSON Schema for incoming messages, null if no schema */
		incoming: JSONSchema | null;
		/** JSON Schema for outgoing messages, null if no schema */
		outgoing: JSONSchema | null;
	} | null;
};

/**
 * Union type for all procedure metadata types
 */
type ProcedureMetadata = GetPostProcedureMetadata | WSProcedureMetadata;

/**
 * Router class that extends Hono with type-safe route definitions and WebSocket support
 * Provides automatic schema validation, middleware chaining, and metadata generation
 * @template T - Record of route operations and nested routes
 * @template E - Environment type extending Hono's Env, defaults to Env
 */
export class Router<
	T extends Record<string, unknown>,
	E extends Env = Env,
> extends Hono<E, RouterSchema<MergeRoutes<T>>, string> {
	/**
	 * Internal metadata storage for router configuration and introspection
	 */
	_metadata: {
		/** Nested sub-routers mapped by path */
		subRouters: Record<string, Router<Record<string, unknown>, E>>;
		/** Router configuration settings */
		config: RouterConfig | Record<string, RouterConfig>;
		/** Procedure metadata for schema introspection */
		procedures: Record<string, ProcedureMetadata>;
		/** List of registered route paths */
		registeredPaths: string[];
	};

	/** Global error handler for the router */
	_errorHandler: ErrorHandler<E> | undefined = undefined;

	/**
	 * Configures the router with optional settings
	 * @param config - Optional router configuration
	 * @returns Router instance for method chaining
	 */
	config(config?: RouterConfig) {
		if (config) {
			this._metadata.config = config;
		}

		return this;
	}

	/**
	 * Returns the underlying Hono handler, stripping types to prevent version mismatch issues
	 * Used internally by Hono adapters
	 */
	get handler(): Hono<E> {
		return this as unknown as Hono<E>;
	}

	/**
	 * Creates a new Router instance with the given procedures
	 * @param procedures - Record of route operations and nested route structures
	 */
	constructor(procedures: T = {} as T) {
		super();

		this._metadata = {
			subRouters: {},
			config: {},
			procedures: {},
			registeredPaths: [],
		};

		// Process procedures to extract metadata
		for (const [procName, value] of Object.entries(procedures)) {
			const procData = value as {
				type: "get" | "post" | "ws";
				schema?: ZodObject;
				incoming?: ZodObject;
				outgoing?: ZodObject;
			};

			if (procData.type === "ws") {
				// Handle WebSocket operations
				this._metadata.procedures[procName] = {
					type: "ws",
					schema: {
						incoming: procData.incoming
							? toJSONSchema(procData.incoming)
							: null,
						outgoing: procData.outgoing
							? toJSONSchema(procData.outgoing)
							: null,
					},
				} satisfies WSProcedureMetadata;
			} else {
				// Handle GET/POST operations
				this._metadata.procedures[procName] = {
					type: procData.type, // Now TypeScript knows this is "get" | "post"
					schema: procData.schema ? toJSONSchema(procData.schema) : null,
				} satisfies GetPostProcedureMetadata;
			}
		}

		this.onError = (handler: ErrorHandler<E>) => {
			this._errorHandler = handler;
			return this;
		};

		this.setupRoutes(procedures);
	}

	/**
	 * Registers middleware for handling sub-router requests
	 * Automatically routes requests to appropriate sub-routers based on path
	 */
	registerSubrouterMiddleware() {
		this.use(async (c, next) => {
			const [basePath, routerName] = c.req.path
				.split("/")
				.filter(Boolean)
				.slice(0, 2);

			const key = `/${basePath}/${routerName}`;
			const subRouter = this._metadata.subRouters[key];

			if (subRouter) {
				const rewrittenPath = `/${c.req.path.split("/").slice(3).join("/")}`;
				const newUrl = new URL(c.req.url);
				newUrl.pathname = rewrittenPath;

				const newRequest = new Request(newUrl, c.req.raw);
				const response = await subRouter.fetch(newRequest, c.env);

				return response;
			}

			return next();
		});
	}

	/**
	 * Sets up routes for all procedures in the router
	 * Handles both flat and nested route structures
	 * @param procedures - The procedures to register as routes
	 */
	private setupRoutes(procedures: T) {
		for (const [key, value] of Object.entries(procedures)) {
			if (this.isOperationType(value)) {
				this.registerOperation(key, value);
			} else if (typeof value === "object" && value !== null) {
				// Handle nested procedures
				const nestedProcedures = value as Record<string, unknown>;
				for (const [subKey, subValue] of Object.entries(nestedProcedures)) {
					if (this.isOperationType(subValue)) {
						this.registerOperation(`${key}/${subKey}`, subValue);
					}
				}
			}
		}
	}

	/**
	 * Type guard to check if a value is a valid operation type
	 * @param value - The value to check
	 * @returns True if the value is an operation type
	 */
	private isOperationType(
		value: unknown,
	): value is OperationType<ZodObject | void, ZodObject | void, E> {
		return (
			value !== null &&
			typeof value === "object" &&
			"type" in value &&
			typeof (value as { type: unknown }).type === "string" &&
			["get", "post", "ws"].includes((value as { type: string }).type)
		);
	}

	/**
	 * Registers a single operation as a route with appropriate middleware and validation
	 * @param path - The route path
	 * @param operation - The operation definition to register
	 */
	private registerOperation(
		path: string,
		// biome-ignore lint/suspicious/noExplicitAny: Output type is not known
		operation: OperationType<ZodObject | void, any, E>,
	) {
		const routePath = `/${path}` as const;

		// Store procedure metadata if not already present
		if (!this._metadata.procedures[path]) {
			if (operation.type === "ws") {
				// Handle WebSocket operation with incoming/outgoing schemas
				const wsOperation = operation;
				this._metadata.procedures[path] = {
					type: "ws",
					schema: {
						incoming: wsOperation.incoming
							? toJSONSchema(wsOperation.incoming)
							: null,
						outgoing: wsOperation.outgoing
							? toJSONSchema(wsOperation.outgoing)
							: null,
					},
				} satisfies WSProcedureMetadata;
			} else {
				// Handle regular operations with single schema
				this._metadata.procedures[path] = {
					type: operation.type, // TypeScript knows this is "get" | "post"
					schema: operation.schema ? toJSONSchema(operation.schema) : null,
				} satisfies GetPostProcedureMetadata;
			}
		}

		// Convert operation middlewares to Hono middleware handlers
		const operationMiddlewares: MiddlewareHandler<E>[] =
			operation.middlewares.map((middleware) => {
				const middlewareHandler = async (c: Context<E>, next: Next) => {
					const typedC = c as ContextWithSuperJSON<
						E & { Variables: InternalContext }
					>;
					const middlewareOutput = typedC.get("__middleware_output") ?? {};

					const nextWrapper = async <B extends Record<string, unknown>>(
						args?: B,
					): Promise<B> => {
						if (args) {
							Object.assign(middlewareOutput, args);
						}
						return args ?? ({} as B);
					};

					const res = await middleware({
						ctx: middlewareOutput,
						next: nextWrapper,
						c: c as ContextWithSuperJSON<E>,
					});

					if (res && typeof res === "object") {
						Object.assign(middlewareOutput, res);
					}

					typedC.set("__middleware_output", middlewareOutput);
					await next();
				};

				return middlewareHandler;
			});

		// Register route based on operation type
		if (operation.type === "get") {
			if (operation.schema) {
				// GET with schema validation
				this.get(
					routePath,
					queryParsingMiddleware,
					...operationMiddlewares,
					async (c) => {
						const typedC = c as Context<E & { Variables: InternalContext }>;
						const ctx = typedC.get("__middleware_output") || {};
						const parsedQuery = typedC.get("__parsed_query");

						const queryInput =
							parsedQuery && Object.keys(parsedQuery).length > 0
								? parsedQuery
								: undefined;

						// Parse and validate input (errors caught at app-level with .onError)
						const input = operation.schema?.parse(queryInput);
						const result = await operation.handler({
							c: c as ContextWithSuperJSON<E>,
							ctx,
							input: input as InferSchema<typeof operation.schema>,
						});

						return result === undefined ? c.json(undefined) : result;
					},
				);
			} else {
				// GET without schema validation
				this.get(routePath, ...operationMiddlewares, async (c) => {
					const typedC = c as Context<E & { Variables: InternalContext }>;
					const ctx = typedC.get("__middleware_output") || {};

					const result = await operation.handler({
						c: c as ContextWithSuperJSON<E>,
						ctx,
						input: undefined as void,
					});
					return result === undefined ? c.json(undefined) : result;
				});
			}
		} else if (operation.type === "post") {
			if (operation.schema) {
				// POST with schema validation
				this.post(
					routePath,
					bodyParsingMiddleware,
					...operationMiddlewares,
					async (c) => {
						const typedC = c as Context<E & { Variables: InternalContext }>;
						const ctx = typedC.get("__middleware_output") || {};
						const parsedBody = typedC.get("__parsed_body");

						const bodyInput =
							parsedBody && Object.keys(parsedBody).length > 0
								? parsedBody
								: undefined;

						// Parse and validate input (errors caught at app-level with .onError)
						const input = operation.schema?.parse(bodyInput);

						const result = await operation.handler({
							c: c as ContextWithSuperJSON<E>,
							ctx,
							input: input as InferSchema<typeof operation.schema>,
						});

						return result === undefined ? c.json(undefined) : result;
					},
				);
			} else {
				// POST without schema validation
				this.post(routePath, ...operationMiddlewares, async (c) => {
					const typedC = c as Context<E & { Variables: InternalContext }>;
					const ctx = typedC.get("__middleware_output") || {};

					const result = await operation.handler({
						c: c as ContextWithSuperJSON<E>,
						ctx,
						input: undefined as void,
					});
					return result === undefined ? c.json(undefined) : result;
				});
			}
		} else if (operation.type === "ws") {
			// WebSocket operation
			const wsOp = operation;

			this.get(
				routePath,
				queryParsingMiddleware,
				...operationMiddlewares,
				async (c) => {
					const typedC = c as Context<
						E & {
							Variables: InternalContext;
							Bindings: WebSocketBindings;
						}
					>;

					// Get Redis configuration from environment
					const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } =
						env(typedC);

					if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
						throw new HTTPException(503, {
							message:
								"Missing required environment variables for WebSockets connection.\n\n" +
								"Real-time WebSockets depend on a persistent connection layer to maintain communication. JSandy uses Upstash Redis to achieve this." +
								"To fix this error:\n" +
								"1. Log in to Upstash Redis at https://upstash.com\n" +
								"2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your environment variables\n\n" +
								"Complete WebSockets guide: https://jsandy.app/docs/websockets\n",
						});
					}

					const ctx = typedC.get("__middleware_output") || {};

					// Create WebSocket pair
					const { 0: client, 1: server } = new WebSocketPair();
					server.accept();

					// Initialize IO and handler
					const io = new IO(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);
					const handler = await wsOp.handler({
						io,
						c: c as ContextWithSuperJSON<E>,
						ctx,
					});

					// Create typed server socket
					const socket = new ServerSocket<
						typeof wsOp.incoming,
						typeof wsOp.outgoing
					>(server, {
						redisUrl: UPSTASH_REDIS_REST_URL,
						redisToken: UPSTASH_REDIS_REST_TOKEN,
						incomingSchema: wsOp.incoming,
						outgoingSchema: wsOp.outgoing,
					});

					// Set up WebSocket event handlers
					handler.onConnect?.({ socket });

					server.onclose = async () => {
						socket.close();
						await handler.onDisconnect?.({ socket });
					};

					server.onerror = async (error) => {
						socket.close();
						await handler.onError?.({ socket, error });
					};

					// Handle incoming messages with validation
					const eventSchema = z.tuple([z.string(), z.unknown()]);
					const logger =
						(ctx as { logger?: { error?: (...args: unknown[]) => void } })
							?.logger?.error ?? console.error;

					server.onmessage = async (event) => {
						try {
							const rawData = z.string().parse(event.data);
							const parsedData = JSON.parse(rawData) as unknown;
							const [eventName, eventData] = eventSchema.parse(parsedData);

							// Handle ping/pong for connection health
							if (eventName === "ping") {
								server.send(JSON.stringify(["pong", null]));
								return;
							}

							socket.handleEvent(
								eventName,
								eventData as InferSchemaType<Schema>,
							);
						} catch (err) {
							logger("Failed to process message:", err);
						}
					};

					// Return WebSocket upgrade response
					return new Response(null, {
						status: 101,
						webSocket: client,
					});
				},
			);
		}
	}
}
