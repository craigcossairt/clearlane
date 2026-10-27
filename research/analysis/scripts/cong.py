import csv, sys, glob, statistics
for pat in sys.argv[1:]:
    mcc, lmp = [], []
    for f in glob.glob(pat):
        for r in csv.DictReader(open(f, newline="")):
            if r["LMP_TYPE"] == "MCC": mcc.append(float(r["MW"]))
            if r["LMP_TYPE"] == "LMP": lmp.append(float(r["MW"]))
    nz = [abs(x) for x in mcc if abs(x) > 0.01]
    print(pat.split('/')[-2], "hours", len(mcc), "nonzero", len(nz), "mean|MCC| when nonzero %.2f" % statistics.mean(nz), "max|MCC| %.2f" % max(nz), "mean MCC %.2f" % statistics.mean(mcc), "mean LMP %.2f" % statistics.mean(lmp), "share of |LMP| from |MCC| %.1f%%" % (100*sum(abs(x) for x in mcc)/sum(abs(x) for x in lmp)))
