# Bundled font provenance

Verified 2026-11-05 against https://www.manus.im/brand . Official brand guide names DM Sans and Libre Baskerville. The actual public home at https://manus.im/ rendered LibreBaskerville for its main heading and a system stack for body text. This is not proof of authenticated application typography.

Unmodified upstream variable files:
- https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf
- https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville%5Bwght%5D.ttf

License copies included alongside each font under SIL OFL 1.1. No Manus logo or artwork is copied.

FontTools cmap inspection of both downloaded files found none of the Arabic letters in `ابتثجحخدذرزسشصضطظعغفقكلمنهوي`. Latin A is present. Arabic therefore intentionally uses the platform system fallback, never a claim that DM Sans or Libre Baskerville is an Arabic Manus face. CSS uses the public reference's UI stack after these Latin fonts. Actual chosen Arabic face varies by device.
