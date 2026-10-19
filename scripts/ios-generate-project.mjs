// No third-party project generator; run after adding/removing Swift source files.
import {createHash} from 'node:crypto';
import {readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
const root = resolve(import.meta.dirname, '..', 'ios');
const id = key => createHash('sha256').update(key).digest('hex').slice(0,24).toUpperCase();
const q = value => JSON.stringify(value);
function files(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(join(dir,entry.name)) : entry.name.endsWith('.swift') ? [relative(root,join(dir,entry.name)).replaceAll('\\','/')] : []); }
const app = files(join(root,'Forma')).sort(), tests = files(join(root,'FormaUITests')).sort(), nativeTests = files(join(root,'FormaNativeTests')).sort();
const objects = [];
const add = (key, value) => {objects.push(`${id(key)} = { ${value} };`); return id(key);};
const refs = new Map();
for (const file of [...app,...tests,...nativeTests]) {
  refs.set(file,add(`ref:${file}`,`isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${q(file)}; sourceTree = SOURCE_ROOT;`));
  add(`build:${file}`,`isa = PBXBuildFile; fileRef = ${id(`ref:${file}`)};`);
}
const appProduct = add('app-product','isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Forma.app; sourceTree = BUILT_PRODUCTS_DIR;');
const testProduct = add('test-product','isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = FormaUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR;');
const nativeTestProduct = add('native-test-product','isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = FormaNativeTests.xctest; sourceTree = BUILT_PRODUCTS_DIR;');
const assets = add('assets','isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Forma/Assets.xcassets; sourceTree = SOURCE_ROOT;');
add('assets-build',`isa = PBXBuildFile; fileRef = ${assets};`);
const privacy = add('privacy','isa = PBXFileReference; lastKnownFileType = text.xml; path = Forma/PrivacyInfo.xcprivacy; sourceTree = SOURCE_ROOT;');
add('privacy-build',`isa = PBXBuildFile; fileRef = ${privacy};`);
const products = add('products',`isa = PBXGroup; children = (${appProduct},${testProduct},${nativeTestProduct}); name = Products; sourceTree = "<group>";`);
const mainGroup = add('main-group',`isa = PBXGroup; children = (${[...refs.values(),assets,privacy,products].join(',')}); sourceTree = "<group>";`);
const packageRef = add('package','isa = XCLocalSwiftPackageReference; relativePath = Packages/FormaCore;');
const packageProduct = add('core-product',`isa = XCSwiftPackageProductDependency; package = ${packageRef}; productName = FormaCore;`);
const coreBuild = add('core-build',`isa = PBXBuildFile; productRef = ${packageProduct};`);
const sourcePhase = (key,list) => add(key,`isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (${list.map(f=>id(`build:${f}`)).join(',')}); runOnlyForDeploymentPostprocessing = 0;`);
const appSources = sourcePhase('app-sources',app), testSources = sourcePhase('test-sources',tests);
const nativeTestSources = sourcePhase('native-test-sources',nativeTests);
const appResources = add('app-resources',`isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (${id('assets-build')},${id('privacy-build')}); runOnlyForDeploymentPostprocessing = 0;`);
const frameworks = add('app-frameworks',`isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (${coreBuild}); runOnlyForDeploymentPostprocessing = 0;`);
const nativeCoreBuild = add('native-core-build',`isa = PBXBuildFile; productRef = ${packageProduct};`);
const nativeFrameworks = add('native-test-frameworks',`isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (${nativeCoreBuild}); runOnlyForDeploymentPostprocessing = 0;`);
function configList(key,appTarget) {
  const configurations = ['Debug','Release'].map(name => {
    const settings = appTarget === null ? {
      CLANG_ENABLE_MODULES:'YES', SWIFT_VERSION:'5.0', IPHONEOS_DEPLOYMENT_TARGET:'17.0', SDKROOT:'iphoneos',
      DEBUG_INFORMATION_FORMAT:name==='Debug'?'dwarf':'dwarf-with-dsym',
      SWIFT_OPTIMIZATION_LEVEL:name==='Debug'?'-Onone':'-O',
      SWIFT_ACTIVE_COMPILATION_CONDITIONS:name==='Debug'?'DEBUG $(inherited)':'$(inherited)',
      ENABLE_TESTABILITY:name==='Debug'?'YES':'NO', CODE_SIGN_STYLE:'Automatic'
    } : appTarget === true ? {
      PRODUCT_BUNDLE_IDENTIFIER:'com.formahealth.app', PRODUCT_NAME:'$(TARGET_NAME)', TARGETED_DEVICE_FAMILY:'1',
      INFOPLIST_FILE:'Config/Info.plist', GENERATE_INFOPLIST_FILE:'NO',
      ASSETCATALOG_COMPILER_APPICON_NAME:'AppIcon', ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME:'AccentColor',
      CURRENT_PROJECT_VERSION:'1', MARKETING_VERSION:'0.1.0',
      LD_RUNPATH_SEARCH_PATHS:'$(inherited) @executable_path/Frameworks',
      SUPPORTS_MACCATALYST:'NO', SUPPORTED_PLATFORMS:'iphoneos iphonesimulator',
      SWIFT_EMIT_LOC_STRINGS:'YES',
      INFOPLIST_KEY_NSAppTransportSecurity_NSAllowsLocalNetworking: name==='Debug'?'YES':'NO'
    } : appTarget === 'native' ? {
      PRODUCT_BUNDLE_IDENTIFIER:'com.formahealth.app.nativetests', PRODUCT_NAME:'$(TARGET_NAME)',
      TARGETED_DEVICE_FAMILY:'1', GENERATE_INFOPLIST_FILE:'YES',
      TEST_HOST:'$(BUILT_PRODUCTS_DIR)/Forma.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Forma', BUNDLE_LOADER:'$(TEST_HOST)',
      LD_RUNPATH_SEARCH_PATHS:'$(inherited) @executable_path/Frameworks @loader_path/Frameworks'
    } : {
      PRODUCT_BUNDLE_IDENTIFIER:'com.formahealth.app.uitests', PRODUCT_NAME:'$(TARGET_NAME)',
      TARGETED_DEVICE_FAMILY:'1', GENERATE_INFOPLIST_FILE:'YES', TEST_TARGET_NAME:'Forma',
      LD_RUNPATH_SEARCH_PATHS:'$(inherited) @executable_path/Frameworks @loader_path/Frameworks'
    };
    const body = Object.entries(settings).map(([k,v])=>`${k} = ${q(v)};`).join(' ');
    return add(`${key}:${name}`,`isa = XCBuildConfiguration; buildSettings = { ${body} }; name = ${name};`);
  });
  return add(key,`isa = XCConfigurationList; buildConfigurations = (${configurations.join(',')}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;`);
}
const projectConfig = configList('project-config',null), appConfig = configList('app-config',true), testConfig = configList('test-config',false);
const nativeTestConfig = configList('native-test-config','native');
const proxy = add('app-proxy',`isa = PBXContainerItemProxy; containerPortal = ${id('project')}; proxyType = 1; remoteGlobalIDString = ${id('app-target')}; remoteInfo = Forma;`);
const dependency = add('app-dependency',`isa = PBXTargetDependency; target = ${id('app-target')}; targetProxy = ${proxy};`);
const appTarget = add('app-target',`isa = PBXNativeTarget; buildConfigurationList = ${appConfig}; buildPhases = (${appSources},${frameworks},${appResources}); buildRules = (); dependencies = (); name = Forma; packageProductDependencies = (${packageProduct}); productName = Forma; productReference = ${appProduct}; productType = "com.apple.product-type.application";`);
const testTarget = add('test-target',`isa = PBXNativeTarget; buildConfigurationList = ${testConfig}; buildPhases = (${testSources}); buildRules = (); dependencies = (${dependency}); name = FormaUITests; productName = FormaUITests; productReference = ${testProduct}; productType = "com.apple.product-type.bundle.ui-testing";`);
const nativeTestTarget = add('native-test-target',`isa = PBXNativeTarget; buildConfigurationList = ${nativeTestConfig}; buildPhases = (${nativeTestSources},${nativeFrameworks}); buildRules = (); dependencies = (${dependency}); name = FormaNativeTests; packageProductDependencies = (${packageProduct}); productName = FormaNativeTests; productReference = ${nativeTestProduct}; productType = "com.apple.product-type.bundle.unit-test";`);
const project = add('project',`isa = PBXProject; attributes = { BuildIndependentTargetsInParallel = 1; LastUpgradeCheck = 1600; TargetAttributes = { ${appTarget} = { CreatedOnToolsVersion = 16.0; }; ${testTarget} = { CreatedOnToolsVersion = 16.0; TestTargetID = ${appTarget}; }; ${nativeTestTarget} = { CreatedOnToolsVersion = 16.0; TestTargetID = ${appTarget}; }; }; }; buildConfigurationList = ${projectConfig}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en,"zh-Hans",Base); mainGroup = ${mainGroup}; packageReferences = (${packageRef}); productRefGroup = ${products}; projectDirPath = ""; projectRoot = ""; targets = (${appTarget},${testTarget},${nativeTestTarget});`);
const dir = join(root,'Forma.xcodeproj');
mkdirSync(join(dir,'xcshareddata','xcschemes'),{recursive:true});
writeFileSync(join(dir,'project.pbxproj'),`// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n${objects.join('\n')}\n}; rootObject = ${project}; }\n`);
const buildRef = (identifier,name) => `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${identifier}" BuildableName="${name}" BlueprintName="${name.replace(/\.(app|xctest)$/,'')}" ReferencedContainer="container:Forma.xcodeproj"/>`;
writeFileSync(join(dir,'xcshareddata','xcschemes','Forma.xcscheme'),`<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${buildRef(appTarget,'Forma.app')}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">${buildRef(nativeTestTarget,'FormaNativeTests.xctest')}</TestableReference><TestableReference skipped="NO">${buildRef(testTarget,'FormaUITests.xctest')}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${buildRef(appTarget,'Forma.app')}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">${buildRef(appTarget,'Forma.app')}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>\n`);
console.log(JSON.stringify({project:'ios/Forma.xcodeproj',appSources:app.length,uiTests:tests.length}));
