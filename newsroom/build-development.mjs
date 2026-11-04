/* Local asset build only. Never provisions or deploys. */
import{mkdir,copyFile}from'node:fs/promises';import{fileURLToPath}from'node:url';import path from'node:path';const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'development-assets','development');await mkdir(out,{recursive:true});for(const name of['index.html','app.mjs','agent-workspace.mjs','platform.css','crm-panel.mjs','goal-panel.mjs','office-export.mjs','api-client.mjs','workflow-dashboard.mjs','plan-editor.mjs','planning-panel.mjs','source-files.mjs','operations-hub.mjs','review-panel.mjs','evidence-export.mjs','review-panel.css'])await copyFile(path.join(root,'client',name),path.join(out,name));await copyFile(path.join(root,'review-controller.mjs'),path.join(out,'review-controller.mjs'));console.log('Built separate development assets locally; no deployment');

await copyFile(path.join(root,'../site/office/vendor/docx.iife.js'),path.join(out,'docx.iife.js'));

await copyFile(path.join(root,'crm-overview.mjs'),path.join(out,'crm-overview.mjs'));

await copyFile(path.join(root,'agent-roles.mjs'),path.join(out,'agent-roles.mjs'));
