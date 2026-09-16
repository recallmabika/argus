import os
import hashlib
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from app.core.config import settings

PRIVATE_KEY_PATH = Path(settings.KEYS_DIR) / "argus_ed25519.pem"
PUBLIC_KEY_PATH = Path(settings.KEYS_DIR) / "argus_ed25519_pub.pem"


class CryptoSigner:
    def __init__(self):
        self.private_key = None
        self.public_key = None
        self._ensure_keys()

    def _ensure_keys(self):
        """Generates or loads the Ed25519 keypair for tamper-proof report signing."""
        if PRIVATE_KEY_PATH.exists() and PUBLIC_KEY_PATH.exists():
            with open(PRIVATE_KEY_PATH, "rb") as f:
                self.private_key = serialization.load_pem_private_key(f.read(), password=None)
            with open(PUBLIC_KEY_PATH, "rb") as f:
                self.public_key = serialization.load_pem_public_key(f.read())
        else:
            self.private_key = ed25519.Ed25519PrivateKey.generate()
            self.public_key = self.private_key.public_key()

            # Save keys to storage
            with open(PRIVATE_KEY_PATH, "wb") as f:
                f.write(
                    self.private_key.private_bytes(
                        encoding=serialization.Encoding.PEM,
                        format=serialization.PrivateFormat.PKCS8,
                        encryption_algorithm=serialization.NoEncryption(),
                    )
                )
            with open(PUBLIC_KEY_PATH, "wb") as f:
                f.write(
                    self.public_key.public_bytes(
                        encoding=serialization.Encoding.PEM,
                        format=serialization.PublicFormat.SubjectPublicKeyInfo,
                    )
                )

    def calculate_sha256(self, data: bytes) -> str:
        """Computes SHA-256 hexadecimal digest of raw bytes."""
        return hashlib.sha256(data).hexdigest()

    def sign(self, data: bytes) -> str:
        """Signs data using Ed25519 private key and returns hex signature."""
        signature = self.private_key.sign(data)
        return signature.hex()

    def verify(self, data: bytes, signature_hex: str) -> bool:
        """Verifies signature against data using the public key."""
        try:
            signature_bytes = bytes.fromhex(signature_hex)
            self.public_key.verify(signature_bytes, data)
            return True
        except Exception:
            return False

    def get_public_key_pem(self) -> str:
        """Returns the public key in PEM format."""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")


signer = CryptoSigner()
