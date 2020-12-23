/**
 * Basic warpper around the watchman node client, making the API nicer.
 *
 * @format
 */

import type { Client } from "fb-watchman";
import type { EventSubscription } from "sundryjs/EventEmitter";

import fbWatchman from "fb-watchman";
// import EventEmitter from "./lib/EventEmitter";
import { spawnSync } from "child_process";
import EventEmitter from "sundryjs/EventEmitter";

type Options = {
	watchmanBinaryPath?: string;
	debug?: boolean;
	printWarnings?: boolean;
};

type LogLevel = "debug" | "error" | "off";
type Scope = "basename" | "wholename";

export enum Operator {
	Equal = "eq",
	NotEqual = "ne",
	GreaterThan = "gt",
	GreaterThanOrEqual = "ge",
	LessThan = "lt",
	LessThanOrEqual = "le",
}
export enum Type {
	BlockSpecialFile = "b",
	CharacterSpecialFile = "c",
	Directory = "d",
	RegularFile = "f",
	NamedPipeFifo = "p",
	SymbolicLink = "s",
	SolarisDoor = "D",
}

type TimeField =
	| "cclock"
	| "oclock"
	| "ctime"
	| "ctime_ms"
	| "ctime_us"
	| "ctime_ns"
	| "ctime_f"
	| "atime"
	| "atime_ms"
	| "atime_us"
	| "atime_ns"
	| "atime_f"
	| "mtime"
	| "mtime_ms"
	| "mtime_us"
	| "mtime_ns"
	| "mtime_f";

type FileFieldError = null | { error: string };
type FileFields = {
	name?: string | FileFieldError;
	exists?: boolean | FileFieldError;
	cclock?: string | FileFieldError;
	oclock?: string | FileFieldError;
	ctime?: number | FileFieldError;
	ctime_ms?: number | FileFieldError;
	ctime_us?: number | FileFieldError;
	ctime_ns?: number | FileFieldError;
	ctime_f?: number | FileFieldError;
	atime?: number | FileFieldError;
	atime_ms?: number | FileFieldError;
	atime_us?: number | FileFieldError;
	atime_ns?: number | FileFieldError;
	atime_f?: number | FileFieldError;
	mtime?: number | FileFieldError;
	mtime_ms?: number | FileFieldError;
	mtime_us?: number | FileFieldError;
	mtime_ns?: number | FileFieldError;
	mtime_f?: number | FileFieldError;
	size?: number | FileFieldError;
	mode?: number | FileFieldError;
	uid?: number | FileFieldError;
	gid?: number | FileFieldError;
	ino?: number | FileFieldError;
	dev?: number | FileFieldError;
	nlink?: number | FileFieldError;
	new?: boolean | FileFieldError;
	type?: Type | FileFieldError;
	symlink_target?: string | FileFieldError;
	"content.sha1hex"?: string | FileFieldError;
};
type Field = keyof FileFields;

type Capability =
	// Expression Terms
	| "term-allof"
	| "term-anyof"
	| "term-dirname"
	| "term-idirname"
	| "term-empty"
	| "term-exists"
	| "term-match"
	| "term-imatch"
	| "term-name"
	| "term-iname"
	| "term-not"
	| "term-pcre"
	| "term-ipcre"
	| "term-since"
	| "term-size"
	| "term-type"
	| "term-suffix"
	| "term-false"
	| "term-true"
	// Field Result Fields
	| "field-name"
	| "field-exists"
	| "field-cclock"
	| "field-oclock"
	| "field-ctime"
	| "field-ctime_ms"
	| "field-ctime_us"
	| "field-ctime_ns"
	| "field-ctime_f"
	| "field-atime"
	| "field-atime_ms"
	| "field-atime_us"
	| "field-atime_ns"
	| "field-atime_f"
	| "field-mtime"
	| "field-mtime_ms"
	| "field-mtime_us"
	| "field-mtime_ns"
	| "field-mtime_f"
	| "field-size"
	| "field-mode"
	| "field-uid"
	| "field-gid"
	| "field-ino"
	| "field-dev"
	| "field-nlink"
	| "field-new"
	| "field-type"
	| "field-symlink_target"
	| "field-content.sha1hex"
	// Command
	| "cmd-find"
	| "cmd-flush-subscriptions"
	| "cmd-get-config"
	| "cmd-get-sockname"
	| "cmd-list-capabilities"
	| "cmd-log"
	| "cmd-log-level"
	| "cmd-query"
	| "cmd-shutdown-server"
	| "cmd-since"
	| "cmd-state-enter"
	| "cmd-state-leave"
	| "cmd-subscribe"
	| "cmd-trigger"
	| "cmd-trigger-del"
	| "cmd-trigger-list"
	| "cmd-unsubscribe"
	| "cmd-version"
	| "cmd-watch"
	| "cmd-watch-del"
	| "cmd-watch-del-all"
	| "cmd-watch-list"
	| "cmd-watch-project"
	// Undocumented commands
	| "cmd-clock"
	| "cmd-debug-ageout"
	| "cmd-debug-contenthash"
	| "cmd-debug-drop-privs"
	| "cmd-debug-get-subscriptions"
	| "cmd-debug-poison"
	| "cmd-debug-recrawl"
	| "cmd-debug-set-subscriptions-paused"
	| "cmd-debug-show-cursors"
	| "cmd-get-pid"
	// Feature Enhancements
	| "relative_root"
	| "wildmatch"
	| "wildmatch-multislash"
	| "dedup_results"
	| "glob_generator"
	| "clock-sync-timeout"
	| "scm-hg"
	| "scm-since"
	| "bser-v2";

type Capabilities = {
	[P in Capability]?: boolean;
};

type CapabilityCheck = {
	optional?: Capability[];
	require?: Capability[];
};

type Config = {
	settle?: number;
	root_files?: string[];
	enforce_root_files?: boolean;
	illegal_fstypes?: string[];
	illegal_fstypes_advice?: string;
	ignore_vcs?: string[];
	ignore_dirs?: string[];
	gc_age_seconds?: number;
	gc_interval_seconds?: number;
	fsevents_latency?: number;
	fsevents_try_resync?: boolean;
	idle_reap_age_seconds?: number;
	hint_num_files_per_dir?: number;
	hint_num_dirs?: number;
	suppress_recrawl_warnings?: boolean;
};

type ClockSpec = string | number;

type MatchFlags = {
	includedotfiles?: boolean;
	noescape?: boolean;
};

type MatchOptions = {
	flags?: MatchFlags;
	scope?: Scope;
};

// Responses
type WarningResponse = { warning?: string };
type ErrorResponse = { version: string; error: string };
type AllResponses<T> = (ErrorResponse | T) & WarningResponse;

// Command Responses
type FindResponse = Record<string, unknown>;
type FlushSubscriptionsResponse = Record<string, unknown>;
type GetConfigResponse = { version: string; config: Config };

type GetSocketNameResponse = { version: string; sockname: string };

type ListCapabilitiesResponse = {
	version: string;
	capabilities: Capabilities;
};

type LogResponse = {
	version: string;
};

type LogLevelResponse = {
	version: string;
	log_level: LogLevel;
};

type QueryResponse = Record<string, unknown>;

type ShutdownResponse = Record<string, unknown>;

type SinceResponse = Record<string, unknown>;

type StateEnterResponse = Record<string, unknown>;

type StateLeaveResponse = Record<string, unknown>;

type SubscribeResponse = {
	// Confirmed
	version: string;
	clock: ClockSpec;
	subscribe: string;
} & EventSubscription;

type TriggerResponse = Record<string, unknown>;

type TriggerDelResponse = Record<string, unknown>;

type TriggerListResponse = Record<string, unknown>;

type UnsubscribeResponse = Record<string, unknown>;

type VersionResponse = {
	version: string;
	buildinfo: string;
	capabilities?: Capabilities;
	error?: string;
};

type WatchResponse = Record<string, unknown>;

type WatchDelResponse = Record<string, unknown>;

type WatchDelAllResponse = Record<string, unknown>;

type WatchListResponse = Record<string, unknown>;

type WatchProjectResponse = {
	// Confirmed
	version: string;
	watcher: string;
	watch: string;
};

// Events
type ConnectEvent = Record<string, unknown>;
type ErrorEvent = { error: Error & { watchmanResponse: any } };
type EndEvent = Record<string, unknown>;
type SubscriptionEvent = {
	// Confirmed
	version: string;
	clock: ClockSpec;
	since?: ClockSpec;
	files?: FileFields[];
	root: string;
	subscription: string;
	unilateral: boolean;
	is_fresh_instance?: boolean;
	metadata?: any; // From either state-enter or state-leave
	"state-enter"?: string;
	"state-leave"?: string;
	init?: boolean;
};
type LogEvent = { level: LogLevel; log: string; unilateral: boolean };

// Expression Types
type Opaque<K, T> = T & { __TYPE__: K };
type Expression = Opaque<"Expression", (capabilities: Capabilities) => any[]>;

type WatchmanEvents = {
	connect: ConnectEvent;
	error: ErrorEvent;
	end: EndEvent;
	subscription: SubscriptionEvent;
	log: LogEvent;
};

class WatchmanEventEmitter extends EventEmitter<WatchmanEvents> {}

const isErrorResponse = <T>(
	response: T | ErrorResponse,
): response is ErrorResponse => {
	return (response as ErrorResponse).error !== undefined;
};

const compatibilityConversionFields: {
	[P in Field]?: "number";
} = {
	ctime: "number",
	ctime_ms: "number",
	ctime_us: "number",
	ctime_ns: "number",
	ctime_f: "number",
	atime: "number",
	atime_ms: "number",
	atime_us: "number",
	atime_ns: "number",
	atime_f: "number",
	mtime: "number",
	mtime_ms: "number",
	mtime_us: "number",
	mtime_ns: "number",
	mtime_f: "number",
	size: "number",
	mode: "number",
	uid: "number",
	gid: "number",
	ino: "number",
	dev: "number",
	nlink: "number",
};
// This is suggested in the documentation, converting Int64 to JavaScript number
// https://facebook.github.io/watchman/docs/nodejs#subscribing-to-changes
const compatibilityConversion = (field: Field, value: any): any => {
	const conversion = compatibilityConversionFields[field];
	if (conversion === "number" && typeof value === "number") {
		return +value;
	}
	return value;
};

class WatchmanClient {
	private options: Options;
	private client: Client;
	private eventEmitter: WatchmanEventEmitter;

	static exists(watchmanBinaryPath?: string): boolean {
		const result = spawnSync(watchmanBinaryPath || "watchman", ["--version"]);
		return result.status === 0;
	}

	constructor(options?: Options) {
		const debugMode = options?.debug || false;

		this.client = new fbWatchman.Client(options);
		this.eventEmitter = new WatchmanEventEmitter();
		this.options = options || {};

		this.client.on("connect", () => {
			if (debugMode) console.debug("Connect Event");
			this.eventEmitter.trigger("connect", {});
		});
		this.client.on("error", (error: Error & { watchmanResponse: any }) => {
			if (debugMode) console.debug("Error Event", { error });
			this.eventEmitter.trigger("error", { error });
		});
		this.client.on("end", () => {
			if (debugMode) console.debug("End Event");
			this.eventEmitter.trigger("end", {});
		});
		this.client.on("subscription", (event: SubscriptionEvent) => {
			if (debugMode) console.debug("Subscription Event", event);
			// Make sure to clean-up across the C++/JavaScript line
			if (event.files) {
				event.files = event.files.map((file) => {
					Object.keys(file).forEach((key: string) => {
						compatibilityConversion(key as Field, file[key as Field]);
					});
					return file;
				});
			}

			this.eventEmitter.trigger("subscription", event);
		});
		this.client.on("log", (event: LogEvent) => {
			if (debugMode) console.debug("Log Event", event);
			this.eventEmitter.trigger("log", event);
		});
	}

	// Events
	onConnect(cb: (event: ConnectEvent) => void): EventSubscription {
		return this.eventEmitter.listen("connect", cb);
	}

	onError(cb: (event: ErrorEvent) => void): EventSubscription {
		return this.eventEmitter.listen("error", cb);
	}

	onEnd(cb: (event: EndEvent) => void): EventSubscription {
		return this.eventEmitter.listen("end", cb);
	}

	onSubscription(cb: (event: SubscriptionEvent) => void): EventSubscription {
		return this.eventEmitter.listen("subscription", cb);
	}

	onLog(cb: (event: LogEvent) => void): EventSubscription {
		return this.eventEmitter.listen("log", cb);
	}

	// Generic low-levl command handling
	// This adds the ability of Promises to the original library.
	private async command<T>(cmd: any[]): Promise<AllResponses<T>> {
		if (cmd.length === 0) {
			throw new Error("No command given.");
		}
		const command = cmd[0];

		if (this.options.debug) {
			console.debug("Request:", cmd);
		}

		return new Promise((resolve, reject) => {
			const handler = (err?: Error | null, resp?: T): void => {
				if (err) {
					if (this.options.debug) {
						console.debug("Response (Error):", command, err);
					}
					reject(err);
				} else if (!resp) {
					reject(new Error("Unknown Promise State."));
				} else {
					if (this.options.debug) {
						console.debug("Response:", command, resp);
					}
					if ((resp as WarningResponse).warning && this.options.printWarnings) {
						console.log(
							`Watchman Warning for ${command}:`,
							(resp as WarningResponse).warning,
						);
					}
					resolve(resp);
				}
			};
			this.client.command(cmd, handler);
		});
	}

	/**
	 * Ends the connection to the watchman server
	 */
	end(): void {
		this.client.end();
	}

	// Commands
	async find(
		path: string,
		options?: { expression?: Expression },
	): Promise<AllResponses<FindResponse>> {
		if (options?.expression) {
			return await this.command<FindResponse>([
				"find",
				path,
				options.expression,
			]);
		}
		return await this.command<FindResponse>(["find", path]);
	}

	async flushSubscriptions(
		path: string,
		options?: { sync_timeout?: number; subscriptions?: string[] },
	): Promise<AllResponses<FlushSubscriptionsResponse>> {
		if (options) {
			return await this.command<FlushSubscriptionsResponse>([
				"flush-subscriptions",
				path,
				options,
			]);
		}
		return await this.command<FlushSubscriptionsResponse>([
			"flush-subscriptions",
			path,
		]);
	}

	async getConfig(path: string): Promise<AllResponses<GetConfigResponse>> {
		return await this.command<GetConfigResponse>(["get-config", path]);
	}

	async getSocketName(): Promise<AllResponses<GetSocketNameResponse>> {
		return await this.command<GetSocketNameResponse>(["get-socketname"]);
	}

	async listCapabilities(): Promise<AllResponses<ListCapabilitiesResponse>> {
		return await this.command<ListCapabilitiesResponse>(["list-capabilities"]);
	}

	async log(level: LogLevel, msg: string): Promise<AllResponses<LogResponse>> {
		return await this.command<LogResponse>(["log", level, msg]);
	}

	async logLevel(level: LogLevel): Promise<AllResponses<LogLevelResponse>> {
		return await this.command<LogLevelResponse>(["log-level", level]);
	}

	async query(
		path: string,
		options?: {
			fields?: Field[];
			expression?: Expression;
			// Generators
			since?: ClockSpec;
			suffix?: string[];
			glob?: string[];
			path?: string[] | { path: string; depth: number }[];
			// Others
			dedup_results?: boolean;
			empty_on_fresh_instance?: boolean;
			relative_root?: string;
			case_sensitive?: boolean;
		},
	): Promise<AllResponses<QueryResponse>> {
		if (options) {
			return await this.command<QueryResponse>(["query", path, options]);
		}
		return await this.command<QueryResponse>(["query", path]);
	}

	async shutdownServer(): Promise<AllResponses<ShutdownResponse>> {
		return await this.command<ShutdownResponse>(["shutdown-server"]);
	}

	async since(
		path: string,
		time: ClockSpec,
		options?: { expression?: Expression },
	): Promise<AllResponses<SinceResponse>> {
		if (options?.expression) {
			return await this.command<SinceResponse>([
				"find",
				path,
				time,
				options.expression,
			]);
		}
		return await this.command<SinceResponse>(["find", path, time]);
	}

	async stateEnter(
		path: string,
		stateName: string,
		options?: { metadata?: any; sync_timeout?: number },
	): Promise<AllResponses<StateEnterResponse>> {
		const requestOptions: {
			name: string;
			metadata?: any;
			sync_timeout?: number;
		} = {
			name: stateName,
			...(options || {}),
		};
		return await this.command<StateEnterResponse>([
			"state-enter",
			path,
			requestOptions,
		]);
	}

	async stateLeave(
		path: string,
		stateName: string,
		options?: { metadata?: any; abandoned?: boolean; sync_timeout?: number },
	): Promise<AllResponses<StateLeaveResponse>> {
		const requestOptions: {
			name: string;
			metadata?: any;
			abandoned?: boolean;
			sync_timeout?: number;
		} = {
			name: stateName,
			...(options || {}),
		};
		return await this.command<StateLeaveResponse>([
			"state-leave",
			path,
			requestOptions,
		]);
	}

	async subscribe(
		path: string,
		subscriptionName: string,
		fields: Field[],
		cb: (event: SubscriptionEvent) => void,
		options?: {
			expression?: Expression;
			since?: ClockSpec;
			defer_vcs?: boolean;
			defer?: boolean;
			drop?: boolean;
		},
	): Promise<AllResponses<SubscribeResponse>> {
		let init = false;
		const handleSubscriptionEvent = (event: SubscriptionEvent): void => {
			if (event.files) {
				event.init = init === false;
				init = true;
			}

			cb(event);
		};

		const subscription = this.eventEmitter.listen(
			"subscription",
			(event: SubscriptionEvent): void => {
				if (event.subscription !== subscriptionName) {
					return;
				}

				handleSubscriptionEvent(event);
			},
		);

		let result;
		if (options) {
			const requestOptions = {
				fields,
				...options,
			};
			result = await this.command<SubscribeResponse>([
				"subscribe",
				path,
				subscriptionName,
				requestOptions,
			]);
		} else {
			result = await this.command<SubscribeResponse>([
				"subscribe",
				path,
				subscriptionName,
			]);
		}

		if (isErrorResponse(result)) {
			// Unsubscribe again
			subscription.remove();
		} else {
			result.remove = subscription.remove;
		}

		return result;
	}

	async trigger(
		path: string,
		triggerName: string,
		command: string[],
		options?: {
			exprssion?: Expression;
			append_files?: boolean;
			stdin?: "/dev/null" | "NAME_PER_LINE" | Field[];
			stdout?: string;
			stderr?: string;
			max_files_stdin?: number;
			chdir?: string;
		},
	): Promise<AllResponses<TriggerResponse>> {
		const requestOptions: {
			name: string;
			command: string[];
			exprssion?: Expression;
			append_files?: boolean;
			stdin?: "/dev/null" | "NAME_PER_LINE" | Field[];
			stdout?: string;
			stderr?: string;
			max_files_stdin?: number;
			chdir?: string;
		} = {
			name: triggerName,
			command,
			...(options || {}),
		};
		return await this.command<TriggerResponse>([
			"trigger",
			path,
			requestOptions,
		]);
	}

	async triggerDelete(
		path: string,
		triggerName: string,
	): Promise<AllResponses<TriggerDelResponse>> {
		return await this.command<TriggerDelResponse>([
			"trigger-del",
			path,
			triggerName,
		]);
	}

	async triggerList(path: string): Promise<AllResponses<TriggerListResponse>> {
		return await this.command<TriggerListResponse>(["trigger-list", path]);
	}

	async unsubscribe(
		path: string,
		subscriptionName: string,
	): Promise<AllResponses<UnsubscribeResponse>> {
		return await this.command<UnsubscribeResponse>([
			"unsubscribe",
			path,
			subscriptionName,
		]);
	}

	async version(
		capabilityCheck?: CapabilityCheck,
	): Promise<AllResponses<VersionResponse>> {
		if (capabilityCheck) {
			return await this.command<VersionResponse>(["version", capabilityCheck]);
		} else {
			return await this.command<VersionResponse>(["version"]);
		}
	}

	async watch(path: string): Promise<AllResponses<WatchResponse>> {
		return await this.command<WatchResponse>(["watch", path]);
	}

	async watchDelete(path: string): Promise<AllResponses<WatchDelResponse>> {
		return await this.command<WatchDelResponse>(["watch-del", path]);
	}

	async watchDeleteAll(): Promise<AllResponses<WatchDelAllResponse>> {
		return await this.command<WatchDelAllResponse>(["watch-del-all"]);
	}

	async watchList(): Promise<AllResponses<WatchListResponse>> {
		return await this.command<WatchListResponse>(["watch-list"]);
	}

	async watchProject(
		path: string,
	): Promise<AllResponses<WatchProjectResponse>> {
		return await this.command<WatchProjectResponse>(["watch-project", path]);
	}
}

export default WatchmanClient;

// Expression Term Utils
const makeExpression = (expr: any[]): Expression => {
	return (expr as unknown) as Expression;
};

// Expression Terms
export const allOf = (...exprs: Expression[]): Expression => {
	return makeExpression(["allof"].concat(exprs as any[]));
};
export const anyOf = (...exprs: Expression[]): Expression => {
	return makeExpression(["anyOf"].concat(exprs as any[]));
};
export const dirname = (
	path: string,
	options?: { depth: number; operator?: Operator },
): Expression => {
	if (options) {
		return makeExpression([
			"dirname",
			path,
			["depth", options.operator || Operator.Equal, options.depth],
		]);
	}
	return makeExpression(["dirname", path]);
};
export const idirname = (
	path: string,
	options?: { depth: number; operator?: Operator },
): Expression => {
	if (options) {
		return makeExpression([
			"idirname",
			path,
			["depth", options.operator || Operator.Equal, options.depth],
		]);
	}
	return makeExpression(["idirname", path]);
};
export const empty = (): Expression => {
	return makeExpression(["empty"]);
};
export const exists = (): Expression => {
	return makeExpression(["exists"]);
};
export const match = (glob: string, options?: MatchOptions): Expression => {
	const scope = options?.scope || "basename";
	if (options?.flags) {
		return makeExpression(["match", glob, scope, options.flags]);
	}
	return makeExpression(["match", glob, scope]);
};
export const imatch = (glob: string, options?: MatchOptions): Expression => {
	const scope = options?.scope || "basename";
	if (options?.flags) {
		return makeExpression(["imatch", glob, scope, options.flags]);
	}
	return makeExpression(["imatch", glob, scope]);
};
export const name = (
	paths: string[],
	options?: { scope?: Scope },
): Expression => {
	const scope = options?.scope || "basename";
	return makeExpression(["name", paths, scope]);
};
export const iname = (
	paths: string[],
	options?: { scope?: Scope },
): Expression => {
	const scope = options?.scope || "basename";
	return makeExpression(["iname", paths, scope]);
};
export const not = (expr: Expression): Expression => {
	return makeExpression(["not", expr]);
};
export const pcre = (
	regex: string[],
	options?: { scope?: Scope },
): Expression => {
	const scope = options?.scope || "basename";
	return makeExpression(["pcre", regex, scope]);
};
export const ipcre = (
	regex: string[],
	options?: { scope?: Scope },
): Expression => {
	const scope = options?.scope || "basename";
	return makeExpression(["ipcre", regex, scope]);
};
export const since = (time: ClockSpec, timeField?: TimeField): Expression => {
	if (timeField) {
		return makeExpression(["since", time, timeField]);
	}
	return makeExpression(["since", time]);
};
export const size = (size: number, operator: Operator): Expression => {
	return makeExpression(["size", operator, size]);
};
export const suffix = (extensions: string[]): Expression => {
	if (extensions.length === 1) {
		return makeExpression(["suffix", extensions[0]]);
	}
	return makeExpression(["suffix", extensions]);
};
export const type = (type: Type): Expression => {
	return makeExpression(["type", type]);
};
export const trueTerm = (): Expression => {
	return makeExpression(["true"]);
};
export const falseTerm = (): Expression => {
	return makeExpression(["false"]);
};

// In case there is a new expression not supported here (yet)
export const customExpression = (...args: any[]): Expression => {
	return makeExpression(args);
};
