"""
Adaptive-streaming transcode for preview videos via AWS Elemental MediaConvert.

When an admin uploads a looping preview clip it lands (private) at
``media/<handle>/<file>`` in S3. We then submit a MediaConvert job that reads
that object and writes, under ``media/hls/<handle>/``:

  * ``master.m3u8`` + per-rendition playlists/segments — a 3-step H.264 ladder
    (1080p / 720p / 480p) so the player adapts to the viewer's bandwidth, and
  * ``poster.0000000.jpg`` — a single frame used as the <video> poster.

Those outputs are public storefront assets served through CloudFront (cheap,
edge-cached, many tiny segment requests). The job is asynchronous; the model
records the job id + predicted output keys immediately and a later poll (see
``catalog/management/commands/sync_transcodes.py``) flips the status.

Everything here is a no-op unless ``settings.TRANSCODE_ENABLED`` is true (a
bucket AND a MediaConvert role ARN are configured), so dev/CI never touch AWS.
"""
from __future__ import annotations

import posixpath

import boto3
from botocore.config import Config
from django.conf import settings

# HLS output prefix for a product, e.g. "media/hls/midnight-noir".
HLS_PREFIX = "media/hls"

# 3-rendition ladder: (height, average bitrate bits/s, max bitrate bits/s).
# 16:9 widths are derived from height. Kept modest — these are short, muted
# loops, not feature films, so the bitrates stay low to cut transcode + egress.
_LADDER = [
    (1080, 5_000_000, 6_500_000),
    (720, 3_000_000, 4_000_000),
    (480, 1_200_000, 1_800_000),
]

# Cache the discovered account endpoint across calls in one process.
_ENDPOINT: str | None = None


def transcode_enabled() -> bool:
    return bool(settings.TRANSCODE_ENABLED)


def output_keys(handle: str) -> dict[str, str]:
    """The S3 keys MediaConvert will write for ``handle`` (known up front)."""
    base = f"{HLS_PREFIX}/{handle}"
    return {
        "hls_key": f"{base}/master.m3u8",
        "poster_key": f"{base}/poster.0000000.jpg",
        "dest": f"s3://{settings.AWS_S3_BUCKET}/{base}/",
    }


def _endpoint() -> str:
    """Resolve the account-specific MediaConvert endpoint (configured or discovered)."""
    global _ENDPOINT
    if settings.MEDIACONVERT_ENDPOINT:
        return settings.MEDIACONVERT_ENDPOINT
    if _ENDPOINT:
        return _ENDPOINT
    disco = boto3.client(
        "mediaconvert",
        region_name=settings.AWS_S3_REGION,
        config=Config(retries={"max_attempts": 3}),
    )
    _ENDPOINT = disco.describe_endpoints()["Endpoints"][0]["Url"]
    return _ENDPOINT


def get_client():
    """Build a MediaConvert client bound to the account endpoint."""
    return boto3.client(
        "mediaconvert",
        region_name=settings.AWS_S3_REGION,
        endpoint_url=_endpoint(),
        config=Config(retries={"max_attempts": 3}),
    )


def _hls_outputs() -> list[dict]:
    outputs = []
    for height, avg, peak in _LADDER:
        outputs.append(
            {
                "NameModifier": f"_{height}p",
                "VideoDescription": {
                    "Height": height,
                    "CodecSettings": {
                        "Codec": "H_264",
                        "H264Settings": {
                            "RateControlMode": "QVBR",
                            "Bitrate": avg,
                            "MaxBitrate": peak,
                            "QvbrSettings": {"QvbrQualityLevel": 7},
                            "GopSize": 90,
                            "GopSizeUnits": "FRAMES",
                            "CodecProfile": "HIGH",
                        },
                    },
                },
                "AudioDescriptions": [
                    {
                        "CodecSettings": {
                            "Codec": "AAC",
                            "AacSettings": {
                                "Bitrate": 96_000,
                                "CodingMode": "CODING_MODE_2_0",
                                "SampleRate": 48_000,
                            },
                        }
                    }
                ],
                "ContainerSettings": {"Container": "M3U8"},
            }
        )
    return outputs


def _build_settings(source_key: str, handle: str) -> dict:
    """Assemble the MediaConvert job ``Settings`` for one preview clip."""
    keys = output_keys(handle)
    source = f"s3://{settings.AWS_S3_BUCKET}/{source_key}"
    return {
        "Inputs": [
            {
                "FileInput": source,
                "AudioSelectors": {
                    "Audio Selector 1": {"DefaultSelection": "DEFAULT"}
                },
                "VideoSelector": {},
                "TimecodeSource": "ZEROBASED",
            }
        ],
        "OutputGroups": [
            {
                "Name": "HLS",
                "OutputGroupSettings": {
                    "Type": "HLS_GROUP_SETTINGS",
                    "HlsGroupSettings": {
                        "SegmentLength": 6,
                        "MinSegmentLength": 0,
                        "Destination": keys["dest"],
                        "DirectoryStructure": "SINGLE_DIRECTORY",
                    },
                },
                "Outputs": _hls_outputs(),
            },
            {
                # One poster frame for the <video> placeholder.
                "Name": "Poster",
                "OutputGroupSettings": {
                    "Type": "FILE_GROUP_SETTINGS",
                    "FileGroupSettings": {"Destination": f"{keys['dest']}poster"},
                },
                "Outputs": [
                    {
                        "VideoDescription": {
                            "CodecSettings": {
                                "Codec": "FRAME_CAPTURE",
                                "FrameCaptureSettings": {
                                    "FramerateNumerator": 1,
                                    "FramerateDenominator": 1,
                                    "MaxCaptures": 1,
                                    "Quality": 80,
                                },
                            }
                        },
                        "ContainerSettings": {"Container": "RAW"},
                        "Extension": "jpg",
                    }
                ],
            },
        ],
    }


def submit_hls_job(source_key: str, handle: str) -> dict[str, str]:
    """Submit an HLS transcode job for ``source_key`` and return its identity.

    Returns ``{"job_id", "hls_key", "poster_key"}``. The output keys are the
    destinations MediaConvert will populate when the job finishes.
    """
    keys = output_keys(handle)
    job_kwargs: dict = {
        "Role": settings.MEDIACONVERT_ROLE_ARN,
        "Settings": _build_settings(source_key, handle),
        # Tag so jobs are attributable in the MediaConvert console / billing.
        "UserMetadata": {"app": "luts_store", "handle": handle},
    }
    if settings.MEDIACONVERT_QUEUE_ARN:
        job_kwargs["Queue"] = settings.MEDIACONVERT_QUEUE_ARN
    resp = get_client().create_job(**job_kwargs)
    return {
        "job_id": resp["Job"]["Id"],
        "hls_key": keys["hls_key"],
        "poster_key": keys["poster_key"],
    }


def job_status(job_id: str) -> str:
    """Return the MediaConvert status string for a job (e.g. COMPLETE, ERROR)."""
    resp = get_client().get_job(Id=job_id)
    return resp["Job"]["Status"]


def is_master_playlist(key: str) -> bool:
    return posixpath.basename(key) == "master.m3u8"
