import { describe, expect, it } from "vitest";
import { buildContainerCreateArgs, buildContainerName, getContainerRuntimePaths } from "./container-adapter.helpers";

describe("container adapter helpers", () => {
  it("builds deterministic docker container names", () => {
    expect(buildContainerName("ins_demo")).toBe("lobster-openclaw-ins_demo");
  });

  it("derives stable in-container paths", () => {
    expect(getContainerRuntimePaths("ins_demo")).toEqual({
      containerGatewayPort: 18789,
      containerHomePath: "/home/node",
      containerWorkspacePath: "/runtime/workspace",
      profileDirPath: "/home/node/.openclaw-ins_demo",
      profileConfigPath: "/home/node/.openclaw-ins_demo/openclaw.json",
    });
  });

  it("builds docker create args with bind mounts and gateway command", () => {
    const args = buildContainerCreateArgs({
      containerName: "lobster-openclaw-ins_demo",
      image: "ghcr.io/openclaw/openclaw:latest",
      instanceId: "ins_demo",
      hostGatewayPort: 19001,
      hostConfigPath: "/tmp/ins_demo/config",
      hostWorkspacePath: "/tmp/ins_demo/workspace",
      hostHomePath: "/tmp/ins_demo/state/home",
      gatewayToken: "demo-token",
      runtimeUser: "990:986",
    });

    expect(args).toContain("create");
    expect(args).toContain("--name");
    expect(args).toContain("lobster-openclaw-ins_demo");
    expect(args).toContain("--entrypoint");
    expect(args).toContain("sh");
    expect(args).toContain("ghcr.io/openclaw/openclaw:latest");
    expect(args).toContain("/tmp/ins_demo/config:/runtime/config");
    expect(args).toContain("/tmp/ins_demo/workspace:/runtime/workspace");
    expect(args).toContain("/tmp/ins_demo/state/home:/home/node");
    expect(args).toContain("19001:18789");
    expect(args).toContain("--user");
    expect(args).toContain("990:986");
    expect(args).toContain("HOME=/home/node");
    expect(args.at(-1)).toContain("gateway run");
    expect(args.at(-1)).toContain("--auth token");
    expect(args.at(-1)).toContain("--token \"demo-token\"");
    expect(args.at(-1)).toContain("--bind lan");
    expect(args.at(-1)).toContain("cp /runtime/config/config.json");
  });
});
