#include <napi.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <Security/Security.h>
#include <CoreFoundation/CoreFoundation.h>

#ifndef LOCAL_PEERTOKEN
#define LOCAL_PEERTOKEN 29
#endif

Napi::Value VerifySocketClient(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "File descriptor (int) expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int fd = info[0].As<Napi::Number>().Int32Value();
    audit_token_t token;
    socklen_t token_len = sizeof(token);
    
    // 1. Get the audit token of the peer connected to the socket
    if (getsockopt(fd, SOL_LOCAL, LOCAL_PEERTOKEN, &token, &token_len) != 0) {
        return Napi::Boolean::New(env, false);
    }
    
    // 2. Convert audit_token_t to CFData for the Security framework
    CFDataRef tokenData = CFDataCreate(kCFAllocatorDefault, (const UInt8*)&token, sizeof(audit_token_t));
    if (!tokenData) {
        return Napi::Boolean::New(env, false);
    }
    
    CFMutableDictionaryRef attributes = CFDictionaryCreateMutable(kCFAllocatorDefault, 1, &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
    CFDictionaryAddValue(attributes, kSecGuestAttributeAudit, tokenData);
    
    // 3. Get the SecCodeRef of the connecting guest process
    SecCodeRef guestCode = NULL;
    OSStatus status = SecCodeCopyGuestWithAttributes(NULL, attributes, kSecCSDefaultFlags, &guestCode);
    CFRelease(attributes);
    CFRelease(tokenData);
    
    if (status != errSecSuccess || !guestCode) {
        if (guestCode) CFRelease(guestCode);
        return Napi::Boolean::New(env, false);
    }
    
    // 4. Get our own SecCodeRef (the daemon)
    SecCodeRef ourCode = NULL;
    status = SecCodeCopySelf(kSecCSDefaultFlags, &ourCode);
    if (status != errSecSuccess || !ourCode) {
        CFRelease(guestCode);
        if (ourCode) CFRelease(ourCode);
        return Napi::Boolean::New(env, false);
    }
    
    // 5. Extract our own Designated Requirement
    SecRequirementRef ourRequirement = NULL;
    status = SecCodeCopyDesignatedRequirement(ourCode, kSecCSDefaultFlags, &ourRequirement);
    CFRelease(ourCode);
    
    if (status != errSecSuccess || !ourRequirement) {
        CFRelease(guestCode);
        if (ourRequirement) CFRelease(ourRequirement);
        return Napi::Boolean::New(env, false);
    }
    
    // 6. Validate the guest code against our own Designated Requirement
    // This mathematically guarantees the connecting process is identical in Code Signature (Team ID + Bundle ID)
    status = SecCodeCheckValidity(guestCode, kSecCSDefaultFlags, ourRequirement);
    
    CFRelease(ourRequirement);
    CFRelease(guestCode);
    
    return Napi::Boolean::New(env, status == errSecSuccess);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "verifySocketClient"), Napi::Function::New(env, VerifySocketClient));
    return exports;
}

NODE_API_MODULE(secure_ipc, Init)
