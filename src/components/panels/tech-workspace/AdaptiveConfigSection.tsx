"use client";

import { useFlowAgentStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RuntimeAdjustableParam, EnvAssumptionEntry, AdjustmentPolicyEntry } from "@/lib/types";

export default function AdaptiveConfigSection() {
  const adaptiveConfig = useFlowAgentStore((s) => s.adaptiveConfig);
  const setAdaptiveConfig = useFlowAgentStore((s) => s.setAdaptiveConfig);

  const { runtimeAdjustable, envAssumptions, adjustmentPolicies } = adaptiveConfig;

  const updateRows = <T,>(field: "runtimeAdjustable" | "envAssumptions" | "adjustmentPolicies", rows: T[]) =>
    setAdaptiveConfig({ [field]: rows } as Parameters<typeof setAdaptiveConfig>[0]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-zinc-800">运行时可调参数</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() =>
              updateRows<RuntimeAdjustableParam>("runtimeAdjustable", [
                ...runtimeAdjustable,
                { path: "", valueType: "string", scope: "warm" },
              ])
            }
          >
            + 添加
          </Button>
        </div>
        <div className="space-y-2">
          {runtimeAdjustable.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 items-end">
              <div className="col-span-4">
                <label className="text-[10px] text-zinc-500">参数路径</label>
                <Input
                  value={row.path}
                  onChange={(e) => {
                    const next = [...runtimeAdjustable];
                    next[i] = { ...next[i], path: e.target.value };
                    updateRows("runtimeAdjustable", next);
                  }}
                  className="h-8 text-[11px] font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500">类型</label>
                <Select
                  value={row.valueType}
                  onValueChange={(v) => {
                    const next = [...runtimeAdjustable];
                    next[i] = { ...next[i], valueType: v as RuntimeAdjustableParam["valueType"] };
                    updateRows("runtimeAdjustable", next);
                  }}
                >
                  <SelectTrigger className="h-8 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="enum">enum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500">scope</label>
                <Select
                  value={row.scope}
                  onValueChange={(v) => {
                    const next = [...runtimeAdjustable];
                    next[i] = { ...next[i], scope: v as RuntimeAdjustableParam["scope"] };
                    updateRows("runtimeAdjustable", next);
                  }}
                >
                  <SelectTrigger className="h-8 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">hot</SelectItem>
                    <SelectItem value="warm">warm</SelectItem>
                    <SelectItem value="cold">cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-zinc-500">说明</label>
                <Input
                  value={row.description ?? ""}
                  onChange={(e) => {
                    const next = [...runtimeAdjustable];
                    next[i] = { ...next[i], description: e.target.value };
                    updateRows("runtimeAdjustable", next);
                  }}
                  className="h-8 text-[11px]"
                />
              </div>
              <div className="col-span-1 flex justify-end pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-400"
                  onClick={() =>
                    updateRows(
                      "runtimeAdjustable",
                      runtimeAdjustable.filter((_, j) => j !== i)
                    )
                  }
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
          {runtimeAdjustable.length === 0 && (
            <p className="text-[11px] text-zinc-400">暂无参数，可点击「添加」。</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-zinc-800">环境假设</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() =>
              updateRows<EnvAssumptionEntry>("envAssumptions", [
                ...envAssumptions,
                {
                  id: `env-${Date.now()}`,
                  description: "",
                  monitorType: "api_health",
                },
              ])
            }
          >
            + 添加
          </Button>
        </div>
        <div className="space-y-3">
          {envAssumptions.map((env, i) => (
            <div key={env.id} className="rounded-lg border border-zinc-200 p-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500">ID</label>
                  <Input
                    value={env.id}
                    onChange={(e) => {
                      const next = [...envAssumptions];
                      next[i] = { ...next[i], id: e.target.value };
                      updateRows("envAssumptions", next);
                    }}
                    className="h-8 text-[11px] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500">监控类型</label>
                  <Input
                    value={env.monitorType}
                    onChange={(e) => {
                      const next = [...envAssumptions];
                      next[i] = { ...next[i], monitorType: e.target.value };
                      updateRows("envAssumptions", next);
                    }}
                    className="h-8 text-[11px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500">描述</label>
                <Input
                  value={env.description}
                  onChange={(e) => {
                    const next = [...envAssumptions];
                    next[i] = { ...next[i], description: e.target.value };
                    updateRows("envAssumptions", next);
                  }}
                  className="h-8 text-[11px]"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() =>
                  updateRows(
                    "envAssumptions",
                    envAssumptions.filter((_, j) => j !== i)
                  )
                }
              >
                删除
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-zinc-800">调整策略</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() =>
              updateRows<AdjustmentPolicyEntry>("adjustmentPolicies", [
                ...adjustmentPolicies,
                {
                  id: `pol-${Date.now()}`,
                  title: "",
                  triggerCondition: "",
                  actions: "",
                },
              ])
            }
          >
            + 添加
          </Button>
        </div>
        <div className="space-y-2">
          {adjustmentPolicies.map((p, i) => (
            <div key={p.id} className="rounded-lg border border-zinc-200 p-2 space-y-2">
              <Input
                placeholder="标题"
                value={p.title}
                onChange={(e) => {
                  const next = [...adjustmentPolicies];
                  next[i] = { ...next[i], title: e.target.value };
                  updateRows("adjustmentPolicies", next);
                }}
                className="h-8 text-[12px] font-medium"
              />
              <Input
                placeholder="触发条件"
                value={p.triggerCondition ?? ""}
                onChange={(e) => {
                  const next = [...adjustmentPolicies];
                  next[i] = { ...next[i], triggerCondition: e.target.value };
                  updateRows("adjustmentPolicies", next);
                }}
                className="h-8 text-[11px] font-mono"
              />
              <Input
                placeholder="动作（逗号分隔）"
                value={p.actions ?? ""}
                onChange={(e) => {
                  const next = [...adjustmentPolicies];
                  next[i] = { ...next[i], actions: e.target.value };
                  updateRows("adjustmentPolicies", next);
                }}
                className="h-8 text-[11px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() =>
                  updateRows(
                    "adjustmentPolicies",
                    adjustmentPolicies.filter((_, j) => j !== i)
                  )
                }
              >
                删除
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
