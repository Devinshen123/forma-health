// Windows-safe static contract/configuration checks. This does not compile Swift or query HealthKit.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const project = read('Forma.xcodeproj/project.pbxproj');
const importer = read('Forma/Infrastructure/AppleHealthImporter.swift');
const app = read('Forma/App/AppStore.swift');
const info = read('Config/Info.plist');
const entitlements = read('Config/Forma.entitlements');
assert.match(info, /NSHealthShareUsageDescription/);
assert.doesNotMatch(info, /NSHealthUpdateUsageDescription/);
assert.match(entitlements, /com\.apple\.developer\.healthkit<\/key><true\/>/);
assert.doesNotMatch(entitlements, /background-delivery/);
assert.equal((project.match(/CODE_SIGN_ENTITLEMENTS = "Config\/Forma.entitlements"/g) ?? []).length, 2);
function swiftFiles(dir) {
  return readdirSync(join(root, dir), {withFileTypes: true}).flatMap(entry => entry.isDirectory()
    ? swiftFiles(`${dir}/${entry.name}`) : entry.name.endsWith('.swift') ? [`${dir}/${entry.name}`] : []);
}
for (const file of [...swiftFiles('Forma'), ...swiftFiles('FormaNativeTests')]) {
  assert.match(project, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(importer, /requestAuthorization\(toShare: \[\], read:/);
assert.match(importer, /HKAnchoredObjectQueryDescriptor<HKSample>/);
assert.match(importer, /limit: 200/);
assert.match(importer, /expectedRevision: expectedRevision/);
assert.ok(importer.indexOf('try await app.uploadAppleHealth') < importer.indexOf('try HealthAnchorVault.save'));
assert.match(app, /api === session\.client/);
assert.match(app, /appleHealth\.invalidate\(\)/);
assert.match(app, /\/api\/health\/apple-health\/import/);
assert.match(read('Forma/Infrastructure/HealthAnchorVault.swift'), /isExcludedFromBackup = true/);
assert.match(read('Forma/Infrastructure/HealthAnchorVault.swift'), /completeFileProtection/);
console.log('Apple Health static configuration and contract checks passed. Swift build and device validation remain separate.');
