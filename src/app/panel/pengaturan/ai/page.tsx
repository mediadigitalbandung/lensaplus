"use client";

import { useSystemSettings } from "@/components/panel/settings/SettingsControls";
import { AiSettingsShell } from "@/components/panel/ai-settings/AiSettingsShell";
import { AiProvidersOverview } from "@/components/panel/ai-settings/AiProvidersOverview";

export default function AiSettingsOverviewPage() {
  const {
    loaded,
    allSettings,
    dirty,
    markDirty,
    saving,
    saveSection,
    testResults,
    runAllAiTest,
  } = useSystemSettings();

  return (
    <AiSettingsShell
      activeSlug="overview"
      title="AI Providers & Routing"
      description="Kelola halaman konfigurasi masing-masing penyedia AI dan atur prioritas penggunaannya."
      settings={allSettings}
      dirty={Boolean(dirty.ai_overview)}
      loaded={loaded}
    >
      <AiProvidersOverview
        settings={allSettings}
        dirty={Boolean(dirty.ai_overview)}
        saving={Boolean(saving.ai_overview)}
        testResult={testResults.ai}
        markDirty={() => markDirty("ai_overview")}
        saveSection={(fields) => saveSection("ai_overview", fields)}
        onTestAllAi={runAllAiTest}
      />
    </AiSettingsShell>
  );
}
