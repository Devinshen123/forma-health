import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSignInDestination} from '../src/auth-navigation';

test('sign-in navigation pins official providers and the configured Casdoor origin/path',()=>{
  assert.equal(validateSignInDestination('https://accounts.google.com/o/oauth2/v2/auth?state=synthetic','google'),'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic');
  assert.equal(validateSignInDestination('https://appleid.apple.com/auth/authorize?state=synthetic','apple'),'https://appleid.apple.com/auth/authorize?state=synthetic');
  const endpoint='http://127.0.0.1:3440/login/oauth/authorize';
  assert.equal(validateSignInDestination(endpoint+'?state=synthetic','casdoor',endpoint),endpoint+'?state=synthetic');
  for(const url of ['http://evil.example/login/oauth/authorize','http://127.0.0.1:3441/login/oauth/authorize','http://127.0.0.1:3440/other','http://user:pass@127.0.0.1:3440/login/oauth/authorize',endpoint+'#unexpected'])assert.throws(()=>validateSignInDestination(url,'casdoor',endpoint));
  assert.throws(()=>validateSignInDestination(endpoint,'casdoor'));
  assert.throws(()=>validateSignInDestination('http://identity.example/login/oauth/authorize','casdoor','http://identity.example/login/oauth/authorize'));
  assert.throws(()=>validateSignInDestination('https://evil.example/auth/authorize','apple'));
  assert.throws(()=>validateSignInDestination('http://accounts.google.com/o/oauth2/v2/auth','google'));
});
