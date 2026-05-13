# CICIDS2017 Dataset

The dataset used by HELIX is the **CIC-IDS-2017** (Canadian Institute for Cybersecurity Intrusion Detection System 2017), published by the University of New Brunswick.

## Download

Official source: https://www.unb.ca/cic/datasets/ids-2017.html

Direct CSV download via Google Drive (UNB mirror):
https://www.kaggle.com/datasets/cicdataset/cicids2017

## Files

Place the downloaded CSVs in this folder. HELIX accepts any subset — you can upload one file or all eight.

| File | Size | Attack Types |
|------|------|-------------|
| `Monday-WorkingHours.pcap_ISCX.csv` | ~169 MB | BENIGN only (baseline) |
| `Tuesday-WorkingHours.pcap_ISCX.csv` | ~129 MB | FTP-Patator, SSH-Patator |
| `Wednesday-workingHours.pcap_ISCX.csv` | ~215 MB | DoS Hulk, DoS GoldenEye, DoS Slowloris, DoS Slowhttptest, Heartbleed |
| `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv` | ~50 MB | Brute Force, XSS, SQL Injection |
| `Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv` | ~80 MB | Infiltration |
| `Friday-WorkingHours-Morning.pcap_ISCX.csv` | ~56 MB | Bot, PortScan |
| `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv` | ~74 MB | PortScan |
| `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv` | ~74 MB | DDoS |

**Total: ~847 MB**

## Why not in the repo?

GitHub enforces a 100 MB per-file limit. All eight CSV files exceed or approach this limit, so they are excluded from version control. The dataset is freely available from UNB and Kaggle.

## Citation

Iman Sharafaldin, Arash Habibi Lashkari, and Ali A. Ghorbani,
"Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization",
4th International Conference on Information Systems Security and Privacy (ICISSP), Portugal, January 2018.
