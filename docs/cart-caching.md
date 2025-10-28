# Cart Caching Implementation

## Overview

An in-memory caching system has been implemented for cart operations to improve performance and reduce Supabase API calls. The cache automatically updates whenever cart operations are performed.

## Features

### In-Memory Cache
- **TTL (Time To Live)**: 5 minutes per cache entry
- **Max Size**: 1000 cached carts (with LRU eviction)
- **Automatic Updates**: Cache is updated on save/delete operations
- **Cache Miss Handling**: Transparent fallback to Supabase storage

### Cache Operations

1. **Cache Hit**: Returns cached data without Supabase call
2. **Cache Miss**: Fetches from Supabase and populates cache
3. **Cache Invalidation**: Automatic on cart modifications
4. **Cache Warming**: Optional manual refresh capability

## Implementation Details

### Core Functions

#### `getCartFromSupabase(sessionId: string)`
- Checks cache first, falls back to Supabase
- Automatically caches retrieved data
- Logs cache hits/misses for monitoring

#### `saveCartToSupabase(sessionId: string, cartItems: CartItem[])`
- Updates Supabase storage
- Refreshes cache with merged items
- Returns updated cart items

#### `deleteCartFromSupabase(sessionId: string, cartItems?)`
- For selective deletion: Updates both storage and cache
- For complete deletion: Invalidates cache entry
- Maintains cache consistency

### Utility Functions

#### `getCartCacheStats()`
```typescript
{
  totalCacheEntries: number;
  validEntries: number;
  expiredEntries: number;
  totalCachedItems: number;
  maxCacheSize: number;
  cacheTtlMs: number;
  memoryUsageEstimate: number; // in bytes
}
```

#### `clearExpiredCartCache()`
- Manually remove expired entries
- Returns count of cleared entries
- Can be called periodically for maintenance

#### `refreshCartCache(sessionId: string)`
- Force refresh specific cart from Supabase
- Useful for cache warming or forcing updates

## Monitoring

### Cache Statistics API
- **Endpoint**: `/api/cache/stats`
- **Method**: GET
- **Authentication**: Admin access required
- **Query Parameter**: `?action=clear-expired` to clear expired entries

### Console Logging
The cache logs all operations for debugging:
- `Cache HIT for cart: {sessionId}`
- `Cache MISS for cart: {sessionId}, fetching from Supabase...`
- `Cache SET for cart: {sessionId} ({itemCount} items)`
- `Cache INVALIDATED for cart: {sessionId}`

## Performance Benefits

### Before Caching
- Every cart operation required Supabase API call
- Multiple sequential reads for the same cart
- Higher latency for frequent cart access

### After Caching
- First read hits Supabase, subsequent reads use cache
- 5-minute TTL ensures reasonable data freshness
- Immediate cache updates on modifications
- Reduced API usage and improved response times

## Configuration

### Cache Settings
```typescript
const CART_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CART_CACHE_MAX_SIZE = 1000; // Maximum cached carts
```

### Environment Considerations
- **Development**: Cache provides faster iteration
- **Production**: Reduces Supabase API costs and improves performance
- **Memory Usage**: ~1KB per cached cart (rough estimate)

## Best Practices

1. **Cache Consistency**: All cart modifications go through caching functions
2. **TTL Management**: 5-minute TTL balances performance vs freshness
3. **Memory Management**: LRU eviction prevents memory leaks
4. **Monitoring**: Regular cache stats review recommended
5. **Error Handling**: Cache failures gracefully fall back to Supabase

## Testing

The caching system can be tested by:
1. Making multiple cart requests for the same session
2. Observing console logs for cache hits/misses
3. Using `/api/cache/stats` endpoint for metrics
4. Monitoring Supabase API usage reduction

## Future Enhancements

Potential improvements:
- Redis-based distributed caching for multi-instance deployments
- Cache preloading for frequently accessed carts
- Configurable TTL per cart based on usage patterns
- Cache warming strategies for better performance