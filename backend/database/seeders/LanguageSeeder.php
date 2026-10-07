<?php

namespace Database\Seeders;

use App\Models\Language;
use Illuminate\Database\Seeder;

class LanguageSeeder extends Seeder
{
    public function run(): void
    {
        $languages = [
            ['code' => 'en', 'name' => 'English', 'native_name' => 'English', 'is_default' => true, 'sort_order' => 1],
            ['code' => 'mr', 'name' => 'Marathi', 'native_name' => 'मराठी', 'is_default' => false, 'sort_order' => 2],
            ['code' => 'hi', 'name' => 'Hindi', 'native_name' => 'हिंदी', 'is_default' => false, 'sort_order' => 3],
        ];

        foreach ($languages as $lang) {
            Language::query()->updateOrCreate(['code' => $lang['code']], $lang + ['is_active' => true]);
        }
    }
}
