# Pure Swift core of the SnowLog media adapter. Foundation (and later Photos) only,
# never ExpoModulesCore or React, so the `Tests` spec builds and runs on a simulator
# without the app host. Expo autolinking does not pass test specs to `pod install`;
# the ios-test custom build declares this pod with `testspecs` before
# `use_expo_modules!` (see .eas/build/ios-test.yml).
Pod::Spec.new do |s|
  s.name           = 'SnowLogMediaCore'
  s.version        = '0.1.0'
  s.summary        = 'SnowLog media adapter core (pure Swift)'
  s.author         = 'kmch4n'
  s.homepage       = 'https://github.com/kmch4n/SnowLog'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = 'Core/Sources/**/*.swift'

  s.test_spec 'Tests' do |t|
    t.source_files = 'Core/Tests/**/*.swift'
  end
end
