import { PluginSettingTab, App, Setting } from "obsidian";
import ScrapbookPlugin, { ScrapbookSettings } from "./main";

class SampleSettingTab extends PluginSettingTab {
  plugin: ScrapbookPlugin;

  constructor(app: App, plugin: ScrapbookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Overtime")
      .setDesc(
        "How much should you be over the time for it to send you a notification?"
      )
      .addText((text) =>
        text
          .setPlaceholder("1.3")
          .setValue(`${this.plugin.settings.overTime}`)
          .onChange(async (value) => {
            this.plugin.settings.overTime = Number.parseFloat(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Generic File Name")
      .setDesc(
        "If you have no question but you're adding a doc, which file should it be added to?"
      )
      .addText((text) =>
        text
          .setPlaceholder("scrapbook")
          .setValue(`${this.plugin.settings.genericDocFilename}`)
          .onChange(async (value) => {
            this.plugin.settings.genericDocFilename = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Working Time")
      .setDesc("How long should each working session be? In minutes")
      .addText((text) =>
        text
          .setPlaceholder("60")
          .setValue(`${this.plugin.settings.workingTime}`)
          .onChange(async (value) => {
            this.plugin.settings.workingTime = Number.parseInt(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Thinking Time")
      .setDesc("How long should each thinking session be? In minutes")
      .addText((text) =>
        text
          .setPlaceholder("8")
          .setValue(`${this.plugin.settings.thinkingTime}`)
          .onChange(async (value) => {
            this.plugin.settings.thinkingTime = Number.parseInt(value);
            await this.plugin.saveSettings();
          })
      );
  }
}

export default SampleSettingTab;
