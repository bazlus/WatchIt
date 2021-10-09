using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WatchIt.Domain.Models;

namespace WatchIt.Domain.ModelConfigurations
{
    public class MovieConfiguration : IEntityTypeConfiguration<Movie>
    {
        public void Configure(EntityTypeBuilder<Movie> builder)
        {
            builder.ToTable("Movies");
            builder
                .HasMany(x => x.Likes)
                .WithOne(x => x.Movie);
            builder
                .HasKey(x => x.Id);
        }
    }
}
