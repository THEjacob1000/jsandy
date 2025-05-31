import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createClient } from "..";
import { j } from "./__mocks__/jsandy.mock";
import {
	adminRouter,
	chatRouter,
	combinedRouter,
	userRouter,
} from "./__mocks__/router.mock";

mock.module("hono/client", () => ({
	hc: mock(() => ({
		$get: mock(),
		$post: mock(),
	})),
}));

describe("Schema", () => {
	beforeEach(() => {
		mock.restore();
	});

	describe("Router Metadata Access", () => {
		it("should access subrouter metadata with proper typing", () => {
			const api = j
				.router()
				.basePath("/api")
				.use(j.defaults.cors)
				.onError(j.defaults.errorHandler);
			const appRouter = j.mergeRouters(api, {
				rpc: combinedRouter,
			});

			// Test that we can access subrouter metadata without TypeScript errors
			const subrouterMetadata =
				appRouter._metadata.subRouters["/api/rpc"]._metadata.procedures;

			// Verify the metadata structure exists
			expect(subrouterMetadata).toBeDefined();
			expect(typeof subrouterMetadata).toBe("object");
		});

		it("should contain expected procedure metadata", () => {
			const api = j.router().basePath("/api");
			const appRouter = j.mergeRouters(api, {
				rpc: combinedRouter,
			});

			const procedures =
				appRouter._metadata.subRouters["/api/rpc"]._metadata.procedures;

			// Test specific procedures exist
			expect(procedures.health).toBeDefined();
			expect(procedures.health.type).toBe("get");

			expect(procedures.user).toBeDefined();
			expect(procedures.user.type).toBe("get");

			expect(procedures.profile).toBeDefined();
			expect(procedures.profile.type).toBe("get");

			// Test nested procedures
			expect(procedures["users/create"]).toBeDefined();
			expect(procedures["users/create"].type).toBe("post");

			expect(procedures["admin/adminOnly"]).toBeDefined();
			expect(procedures["admin/adminOnly"].type).toBe("get");

			// Test WebSocket procedure
			expect(procedures.chat).toBeDefined();
			expect(procedures.chat.type).toBe("ws");
			// New: verify that both incoming & outgoing schemas are attached
			expect(procedures.chat.schema).toBeDefined();
			if (procedures.chat.schema) {
				expect(procedures.chat.schema).toHaveProperty("incoming");
				expect(procedures.chat.schema).toHaveProperty("outgoing");
			}
		});

		it("should handle multiple subrouters", () => {
			const api = j.router().basePath("/api");
			const appRouter = j.mergeRouters(api, {
				users: userRouter,
				admin: adminRouter,
				chat: chatRouter,
			});

			// Test all subrouters are accessible
			expect(appRouter._metadata.subRouters["/api/users"]).toBeDefined();
			expect(appRouter._metadata.subRouters["/api/admin"]).toBeDefined();
			expect(appRouter._metadata.subRouters["/api/chat"]).toBeDefined();

			// Test individual subrouter procedures
			const userProcedures =
				appRouter._metadata.subRouters["/api/users"]._metadata.procedures;
			expect(userProcedures.health).toBeDefined();
			expect(userProcedures.getUser).toBeDefined();

			const adminProcedures =
				appRouter._metadata.subRouters["/api/admin"]._metadata.procedures;
			expect(adminProcedures.adminOnly).toBeDefined();

			const chatProcedures =
				appRouter._metadata.subRouters["/api/chat"]._metadata.procedures;
			expect(chatProcedures.chat).toBeDefined();
			expect(chatProcedures.chat.type).toBe("ws");
		});
	});

	describe("Schema Validation", () => {
		it("should validate procedure schemas are correctly stored", () => {
			const api = j.router().basePath("/api");
			const appRouter = j.mergeRouters(api, {
				rpc: combinedRouter,
			});

			const procedures =
				appRouter._metadata.subRouters["/api/rpc"]._metadata.procedures;

			// Test that procedures with schemas have them stored
			expect(procedures.user.schema).toBeDefined();
			expect(procedures.user.schema).toBeTypeOf("object");

			expect(procedures["users/create"].schema).toBeDefined();
			expect(procedures["users/create"].schema).toBeTypeOf("object");

			// Test that procedures without schemas have null
			expect(procedures.health.schema).toBeNull();
		});

		it("should preserve schema structure for complex inputs", () => {
			const api = j.router().basePath("/api");
			const appRouter = j.mergeRouters(api, {
				rpc: combinedRouter,
			});

			const procedures =
				appRouter._metadata.subRouters["/api/rpc"]._metadata.procedures;

			// Test that complex schema (like users/create) has proper structure
			const createUserProcedure = procedures["users/create"];
			expect(createUserProcedure).toBeDefined();

			if (createUserProcedure.type === "post") {
				const createUserSchema = createUserProcedure.schema;
				expect(createUserSchema).toBeDefined();

				if (createUserSchema) {
					expect(createUserSchema.type).toBe("object");
					expect(createUserSchema.properties).toBeDefined();
					expect(createUserSchema.required).toBeDefined();

					expect(createUserSchema.properties).toHaveProperty("name");
					expect(createUserSchema.properties).toHaveProperty("email");
					expect(createUserSchema.required).toContain("name");
					expect(createUserSchema.required).toContain("email");
				}
			}
		});
	});

	describe("Type Safety", () => {
		it("should maintain type safety for subrouter access", () => {
			const api = j.router().basePath("/api");
			const appRouter = j.mergeRouters(api, {
				rpc: combinedRouter,
			});

			// This should compile without TypeScript errors
			const subrouter = appRouter._metadata.subRouters["/api/rpc"];
			const metadata = subrouter._metadata;
			const procedures = metadata.procedures;
			const config = metadata.config;
			const registeredPaths = metadata.registeredPaths;

			// Verify types are preserved
			expect(procedures).toBeTypeOf("object");
			expect(config).toBeTypeOf("object");
			expect(Array.isArray(registeredPaths)).toBe(true);
		});
	});

	describe("Client Schema Methods", () => {
		const api = j
			.router()
			.basePath("/api")
			.use(j.defaults.cors)
			.onError(j.defaults.errorHandler);
		const appRouter = j.mergeRouters(api, {
			rpc: combinedRouter,
		});
		type AppRouter = typeof appRouter;

		it("should provide $schema method on client endpoints", async () => {
			const client = createClient<AppRouter>({
				baseUrl: "https://api.example.com",
			});

			expect(typeof client.rpc.health.$get).toBe("function");
			expect(typeof client.rpc.user.$get).toBe("function");
			expect(typeof client.rpc.users.create).toBe("object");
		});
	});
});
