<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MilkPriceRequest;
use App\Models\MilkPrice;
use Illuminate\Http\JsonResponse;

class MilkPriceController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => MilkPrice::query()->latest('effective_from')->orderBy('session')->limit(200)->get(),
        ]);
    }

    public function store(MilkPriceRequest $request): JsonResponse
    {
        $price = MilkPrice::query()->make($request->validated());
        $price->created_by = $request->user()->id;
        $price->save();

        return response()->json(['data' => $price], 201);
    }

    public function update(MilkPriceRequest $request, MilkPrice $price): JsonResponse
    {
        $price->update($request->validated());

        return response()->json(['data' => $price]);
    }

    /** Safe: entries store their own rate snapshot, so deleting a price never changes history. */
    public function destroy(MilkPrice $price): JsonResponse
    {
        abort_unless(request()->user()->hasPermission('settings.manage'), 403);

        $price->delete();

        return response()->json(['deleted' => true]);
    }
}
