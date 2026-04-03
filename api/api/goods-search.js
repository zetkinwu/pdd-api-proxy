// 拼多多商品搜索API代理
const crypto = require('node:crypto');

const PDD_CONFIG = {
  apiUrl: 'https://gw-api.pinduoduo.com/api/router',
  clientId: process.env.PDD_CLIENT_ID,
  clientSecret: process.env.PDD_CLIENT_SECRET
};

function generateSign(params, clientSecret) {
  const sortedKeys = Object.keys(params).sort();
  let signStr = clientSecret;
  for (const key of sortedKeys) {
    signStr += key + params[key];
  }
  signStr += clientSecret;
  return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
}

function buildFormData(params) {
  const pairs = [];
  for (const [key, value] of Object.entries(params)) {
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return pairs.join('&');
}

function buildApiParams(type, data) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    type: type,
    client_id: PDD_CONFIG.clientId,
    timestamp: timestamp.toString(),
    data_type: 'JSON',
    version: 'V1',
    ...data
  };
  params.sign = generateSign(params, PDD_CONFIG.clientSecret);
  return params;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    const { keyword, page = 1, pageSize = 20 } = req.query;
    
    if (!keyword) {
      return res.status(400).json({
        error: '缺少关键词参数',
        success: false
      });
    }

    if (!PDD_CONFIG.clientId || !PDD_CONFIG.clientSecret) {
      return res.status(500).json({
        error: 'API配置错误：缺少client_id或client_secret',
        success: false
      });
    }

    const apiParams = buildApiParams('pdd.ddk.goods.search', {
      keyword: keyword,
      page: page.toString(),
      page_size: pageSize.toString(),
      sort_type: '0',
      with_coupon: 'false'
    });

    const response = await fetch(PDD_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
      body: buildFormData(apiParams)
    });

    const data = await response.json();

    if (data.error_response) {
      return res.status(400).json({
        error: data.error_response.error_msg,
        error_code: data.error_response.error_code,
        success: false
      });
    }

    const goodsList = data.goods_search_response?.goods_list || [];
    const formattedGoods = goodsList.map(item => ({
      id: item.goods_id,
      name: item.goods_name,
      image: item.goods_thumbnail_url,
      price: (item.min_group_price / 100).toFixed(2),
      originalPrice: (item.max_normal_price / 100).toFixed(2),
      hasCoupon: item.coupon_remain_quantity > 0,
      couponDiscount: (item.coupon_discount / 100).toFixed(2),
      sales: item.sales_tip,
      mallName: item.mall_name,
      link: item.goods_sign || ''
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      success: true,
      data: {
        total: data.goods_search_response?.total_count || 0,
        goodsList: formattedGoods
      }
    });

  } catch (error) {
    console.error('API调用错误:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message,
      success: false
    });
  }
};
