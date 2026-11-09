# The Expo module: the JS-facing surface. PhotoKit logic lives in SnowLogMediaCore,
# which has no ExpoModulesCore dependency so its XCTest target can run without the app
# (#86 Task C, instrument I1).
Pod::Spec.new do |s|
  s.name           = 'SnowLogMedia'
  s.version        = '0.1.0'
  s.summary        = 'SnowLog media adapter (Expo module)'
  s.author         = 'kmch4n'
  s.homepage       = 'https://github.com/kmch4n/SnowLog'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'SnowLogMediaCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = 'Module/**/*.swift'
end
