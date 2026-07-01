#!/usr/bin/env python3
"""
蚂蚁财富达人实盘数据抓取脚本
=================================
本脚本从蚂蚁财富/支付宝基金平台抓取基金达人的实盘数据，
包括持仓汇总、交易明细、持仓明细和板块分布，输出为 JSON 文件，
供 NanStar Wealth 前端"基金"模块读取展示。

使用方法:
  python scrape.py                    # 抓取所有达人数据
  python scrape.py --output out.json   # 指定输出文件
  python scrape.py --config my.json    # 使用自定义配置文件

前置条件:
  1. 配置好 config.json 中的认证信息（Cookie/Token）
  2. pip install requests

输出文件:
  ../output/fund_data.json  (默认)
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime

try:
    import requests
except ImportError:
    print("错误：缺少 requests 库，请运行: pip install requests")
    sys.exit(1)


# ============================================================
#  配置加载
# ============================================================

def load_config(config_path=None):
    """加载配置文件，优先使用参数指定的路径"""
    if config_path is None:
        config_path = os.path.join(os.path.dirname(__file__), "config.json")

    if not os.path.exists(config_path):
        print(f"[!] 配置文件不存在: {config_path}")
        print("    请复制 config.json.example 为 config.json 并填写认证信息")
        print("    如何获取认证信息：")
        print("    1. 在电脑上安装 Charles / mitmproxy")
        print("    2. 配置手机代理，安装 CA 证书")
        print("    3. 打开支付宝 APP → 理财 → 达人广场")
        print("    4. 在 Charles 中找到 host 为 *.alipay.com 或 antfortune 的请求")
        print("    5. 复制 Cookie / Authorization 头到 config.json")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================
#  API 请求层
# ============================================================

class FundGuruScraper:
    """蚂蚁财富达人数据抓取器"""

    def __init__(self, config):
        self.base_url = config.get("base_url", "https://antfortune.alipay.com")
        self.headers = {
            "User-Agent": config.get("user_agent",
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36"),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Cookie": config.get("cookie", ""),
        }
        if config.get("authorization"):
            self.headers["Authorization"] = config["authorization"]
        if config.get("referer"):
            self.headers["Referer"] = config["referer"]

        self.guru_ids = config.get("guru_ids", [])
        self.timeout = config.get("timeout", 30)
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def _request(self, method, path, **kwargs):
        """统一请求封装"""
        url = f"{self.base_url}{path}"
        kwargs.setdefault("timeout", self.timeout)
        resp = self.session.request(method, url, **kwargs)
        resp.raise_for_status()
        return resp.json()

    # ---- 以下接口方法需要根据实际抓包结果调整 ----

    def fetch_guru_list(self):
        """
        获取关注的达人列表 / 达人广场排行
        TODO: 替换为实际的 API 端点和参数
        """
        # 示例: /api/fund/guru/ranking?pageSize=50
        return self._request("GET", "/api/fund/guru/ranking",
            params={"pageSize": 50, "sortBy": "totalValue"})

    def fetch_guru_portfolio(self, guru_id):
        """
        获取单个达人的持仓汇总
        TODO: 替换为实际的 API 端点和参数
        """
        # 示例: /api/fund/guru/{id}/portfolio
        return self._request("GET", f"/api/fund/guru/{guru_id}/portfolio")

    def fetch_guru_trades(self, guru_id, date=None):
        """
        获取单个达人近期的交易记录
        TODO: 替换为实际的 API 端点和参数
        """
        params = {"guruId": guru_id, "pageSize": 100}
        if date:
            params["date"] = date
        return self._request("GET", "/api/fund/guru/trades", params=params)

    def fetch_guru_holdings(self, guru_id):
        """
        获取单个达人的持仓明细（每只基金）
        TODO: 替换为实际的 API 端点和参数
        """
        return self._request("GET", f"/api/fund/guru/{guru_id}/holdings")


# ============================================================
#  数据处理层
# ============================================================

def parse_guru_summary(raw_guru):
    """解析单个达人汇总数据（根据实际 API 返回格式调整）"""
    return {
        "name": raw_guru.get("nickname") or raw_guru.get("name", ""),
        "totalValue": raw_guru.get("totalAsset") or raw_guru.get("totalValue", 0),
        "returnRate": raw_guru.get("totalReturnRate") or raw_guru.get("returnRate", 0),
        "heavySector": raw_guru.get("heavySector") or "--",
        "heavyRatio": raw_guru.get("heavySectorRatio") or raw_guru.get("heavyRatio"),
        "sectorCount": raw_guru.get("sectorCount", 0),
        "lastTrade": raw_guru.get("lastTradeTime") or raw_guru.get("lastTrade", "--"),
    }


def parse_trade_record(raw_trade):
    """解析单条交易记录"""
    return {
        "name": raw_trade.get("guruName") or raw_trade.get("nickname", ""),
        "time": raw_trade.get("tradeTime") or raw_trade.get("time", ""),
        "action": raw_trade.get("actionType") or raw_trade.get("action", ""),
        "fundName": raw_trade.get("fundName") or raw_trade.get("name", ""),
        "shares": raw_trade.get("shares"),
        "amount": raw_trade.get("amount"),
        "ratio": raw_trade.get("positionRatio") or raw_trade.get("ratio"),
    }


def parse_holding_detail(raw_holding):
    """解析单条持仓明细"""
    return {
        "name": raw_holding.get("guruName") or raw_holding.get("nickname", ""),
        "fundName": raw_holding.get("fundName") or raw_holding.get("name", ""),
        "sector": raw_holding.get("sectorName") or raw_holding.get("sector", "--"),
        "amount": raw_holding.get("marketValue") or raw_holding.get("amount", 0),
        "ratio": raw_holding.get("weight") or raw_holding.get("ratio"),
        "profit": raw_holding.get("totalProfit") or raw_holding.get("profit", 0),
        "profitRate": raw_holding.get("totalProfitRate") or raw_holding.get("profitRate", 0),
    }


def compute_sector_distribution(holdings):
    """
    从持仓明细计算板块分布。
    你也可以从达人汇总的重仓板块直接统计。
    """
    sector_amount = {}
    total_amount = 0
    for h in holdings:
        sector = h.get("sector", "--")
        amount = h.get("amount", 0) or 0
        sector_amount[sector] = sector_amount.get(sector, 0) + amount
        total_amount += amount

    result = []
    for sector, amt in sorted(sector_amount.items(), key=lambda x: -x[1]):
        if sector == "--":
            sector = "未识别"
        result.append({
            "name": sector,
            "ratio": amt / total_amount if total_amount > 0 else 0
        })
    return result


# ============================================================
#  主流程
# ============================================================

def scrape_all(config_path, output_path):
    """完整抓取流程"""
    config = load_config(config_path)
    scraper = FundGuruScraper(config)

    all_gurus = []
    all_trades = []
    all_holdings = []

    # 如果没有配置达人 ID，先拉取排行榜
    if not scraper.guru_ids:
        print("[*] 未配置 guru_ids，尝试拉取达人排行榜...")
        try:
            ranking = scraper.fetch_guru_list()
            guru_list = ranking.get("data", {}).get("list", []) or ranking.get("list", [])
            scraper.guru_ids = [g.get("userId") or g.get("guruId") for g in guru_list[:50]]
            print(f"    获取到 {len(scraper.guru_ids)} 位达人")
        except Exception as e:
            print(f"[!] 获取达人列表失败: {e}")
            print("    请在 config.json 中手动填写 guru_ids")
            return 1

    total = len(scraper.guru_ids)
    for idx, guru_id in enumerate(scraper.guru_ids, 1):
        print(f"[{idx}/{total}] 正在抓取达人 {guru_id} ...")
        try:
            # 达人汇总
            portfolio = scraper.fetch_guru_portfolio(guru_id)
            guru_data = portfolio.get("data", portfolio)
            all_gurus.append(parse_guru_summary(guru_data))

            # 交易记录
            trades = scraper.fetch_guru_trades(guru_id)
            trade_list = trades.get("data", {}).get("list", []) or trades.get("list", [])
            for t in trade_list:
                all_trades.append(parse_trade_record(t))

            # 持仓明细
            holdings = scraper.fetch_guru_holdings(guru_id)
            holding_list = holdings.get("data", {}).get("list", []) or holdings.get("list", [])
            for h in holding_list:
                all_holdings.append(parse_holding_detail(h))

            # 礼貌延迟，避免触发反爬
            time.sleep(config.get("request_delay", 0.5))
        except Exception as e:
            print(f"    [!] 抓取失败: {e}")
            continue

    # 计算板块分布
    sectors = compute_sector_distribution(all_holdings)

    # 组装输出
    output = {
        "updateTime": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "guruCount": len(all_gurus),
        "tradeCount": len(all_trades),
        "holdingCount": len(all_holdings),
        "gurus": all_gurus,
        "trades": all_trades,
        "holdings": all_holdings,
        "sectors": {
            "holding": sectors,
            "inflow": [],   # 资金流入需要额外计算（对比昨日数据）
            "outflow": [],  # 资金流出需要额外计算
        },
    }

    # 确保输出目录存在
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n[✓] 抓取完成！共 {len(all_gurus)} 位达人")
    print(f"    交易记录: {len(all_trades)} 条")
    print(f"    持仓明细: {len(all_holdings)} 条")
    print(f"    输出文件: {output_path}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="蚂蚁财富达人实盘数据抓取")
    parser.add_argument("--config", default=None, help="配置文件路径")
    parser.add_argument("--output", default=None, help="输出 JSON 文件路径")
    args = parser.parse_args()

    config_path = args.config
    output_path = args.output
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if output_path is None:
        output_path = os.path.join(script_dir, "..", "output", "fund_data.json")

    return scrape_all(config_path, output_path)


if __name__ == "__main__":
    sys.exit(main())
